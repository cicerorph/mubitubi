const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const sanitizeHtml = require('sanitize-html');
const db = require('../utils/db');
const { ensureAuthenticated } = require('../utils/util');
const { uuid } = require('uuidv4');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Initialize AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'files/videos');
    },
    filename: function (req, file, cb) {
        const videoId = req.videoId;
        cb(null, videoId + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Not a video file!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 80 * 1024 * 1024 } // 80 MB
});

// Helper function to upload file to S3
const uploadToS3 = async (filePath, key) => {
    const fileContent = fs.readFileSync(filePath);
    const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: fileContent
    };
    
    return s3.upload(params).promise();
};

module.exports = (app) => {
    app.post('/upload', ensureAuthenticated, (req, res, next) => {
        req.videoId = uuid();
        next();
    }, upload.single('video'), async (req, res) => {
        if (!req.file) {
            return res.status(400).send('No file uploaded or file is not a video.');
        }

        const videoId = req.videoId;
        const title = sanitizeHtml(req.body.title).trim().substring(0, 30);
        const description = sanitizeHtml(req.body.description).trim().replace(/\r\n/g, '\n').substring(0, 100);

        if (!title || !description) return res.status(400).send("No Description Or Title");

        const videoPath = req.file.path;
        const videoFilename = path.basename(videoPath);
        const thumbnailFilename = videoFilename + '.png';
        const thumbnailPath = path.join('files/thumbnails', thumbnailFilename);

        try {
            // Upload video to S3
            const videoUpload = await uploadToS3(videoPath, `videos/${videoFilename}`);
            const videoUrl = process.env.AWS_CLOUDFRONT_URL && process.env.AWS_CLOUDFRONT_URL !== ""
                ? `${process.env.AWS_CLOUDFRONT_URL}/videos/${videoFilename}`
                : videoUpload.Location;

            // Generate thumbnail
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        count: 1,
                        folder: 'files/thumbnails',
                        filename: thumbnailFilename,
                        size: '1920x1080'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Upload thumbnail to S3
            const thumbnailUpload = await uploadToS3(thumbnailPath, `thumbnails/${thumbnailFilename}`);
            const thumbnailUrl = process.env.AWS_CLOUDFRONT_URL && process.env.AWS_CLOUDFRONT_URL !== ""
                ? `${process.env.AWS_CLOUDFRONT_URL}/thumbnails/${thumbnailFilename}`
                : thumbnailUpload.Location;

            const videoDetails = {
                id: videoId,
                uploader: req.user,
                url: `${process.env.BASE_URL}/video/${videoId}`,
                video: videoUrl,
                thumbnail: thumbnailUrl,
                title,
                description,
                uploadedAt: Date.now(),
                verified: false
            };

            await db.set(videoId, videoDetails);

            // Clean up local files
            fs.unlinkSync(videoPath);
            fs.unlinkSync(thumbnailPath);

            res.status(200).send({ videoId });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).send('Error processing upload.');
            
            // Clean up any local files if they exist
            try {
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
    });
};

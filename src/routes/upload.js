const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const sanitizeHtml = require('sanitize-html');
const db = require('../utils/db');
const { ensureAuthenticated } = require('../utils/util');
const { uuid } = require('uuidv4');
const BunnyStorage = require('bunnycdn-storage').default;
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Initialize BunnyStorage
const bunnyStorage = new BunnyStorage(process.env.BUNNY_API_KEY, process.env.BUNNY_STORAGE_ZONE);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'files/videos');
    },
    filename: function (req, file, cb) {
        const videoId = req.videoId; // Get the videoId from the request object
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
    fileFilter: fileFilter
});

module.exports = (app) => {
    app.post('/upload', ensureAuthenticated, (req, res, next) => {
        req.videoId = uuid(); // generate the id before the upload function
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
            // Upload video to Bunny.net
            await bunnyStorage.upload(videoPath, videoFilename);

            // Download the video back from Bunny.net to generate the thumbnail
            const videoUrl = `https://${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net/${videoFilename}`;
            const localVideoPath = path.join('files/videos', videoFilename);

            const response = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(localVideoPath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                // Generate thumbnail
                ffmpeg(localVideoPath)
                    .screenshots({
                        count: 1,
                        folder: 'files/thumbnails',
                        filename: thumbnailFilename,
                        size: '1920x1080'
                    })
                    .on('end', async () => {
                        try {
                            // Upload thumbnail to Bunny.net
                            await bunnyStorage.upload(thumbnailPath, thumbnailFilename);

                            const videoDetails = {
                                id: videoId,
                                uploader: req.user,
                                url: `${process.env.BASE_URL}/video/${videoId}`,
                                video: videoUrl,
                                thumbnail: `https://${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net/${thumbnailFilename}`,
                                title,
                                description,
                                uploadedAt: Date.now(),
                                verified: false
                            };

                            await db.set(videoId, videoDetails);

                            res.status(200).send({ videoId });
                        } catch (error) {
                            res.status(500).send('Error uploading thumbnail to Bunny.net.');
                        }
                    })
                    .on('error', (err) => {
                        res.status(500).send('Error generating thumbnail.');
                    });
            });

            writer.on('error', (err) => {
                res.status(500).send('Error downloading video from Bunny.net.');
            });
        } catch (error) {
            res.status(500).send('Error uploading video to Bunny.net.');
        }
    });

    app.delete('/delete/:videoId', ensureAuthenticated, async (req, res) => {
        const videoId = req.params.videoId;

        try {
            // Check if the user is a staff member
            if (!req.user.isStaff) {
                return res.status(403).send('Unauthorized. Only staff members can delete videos.');
            }

            // Get video details from the database
            const videoDetails = await db.get(videoId);

            if (!videoDetails) {
                return res.status(404).send('Video not found');
            }

            const videoSplit = video.video.split("https://mubitubi.b-cdn.net/")
// https://mubitubi.b-cdn.net/e56c80d9-c610-4d5a-997e-8868bab5f5fc-gwombler.mp4

            // Delete video and thumbnail from Bunny.net
            await bunnyStorage.delete(videoSplit[1]);
            await bunnyStorage.delete(videoSplit[1] + ".png");

            // Delete video entry from the database
            await db.delete(videoId);

            res.status(200).send('Video deleted successfully');
        } catch (error) {
            res.status(500).send('Error deleting video');
        }
    });
};
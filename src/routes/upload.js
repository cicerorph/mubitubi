const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const sanitizeHtml = require('sanitize-html');
const db = require('../utils/db');
const { ensureAuthenticated } = require('../utils/util');
const { uuid } = require('uuidv4');

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
        const thumbnailPath = 'files/thumbnails/' + req.file.filename + '.png';

        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                folder: 'files/thumbnails',
                filename: req.file.filename + '.png',
                size: '1920x1080'
            })
            .on('end', async () => {
                try {
                    const videoDetails = {
                        id: videoId,
                        uploader: req.user,
                        url: `${process.env.BASE_URL}/video/${videoId}`,
                        video: `${process.env.BASE_URL}/files/videos/${req.file.filename}`,
                        thumbnail: `${process.env.BASE_URL}/files/thumbnails/${req.file.filename}.png`,
                        title,
                        description,
                        uploadedAt: Date.now(),
                        verified: false
                    };

                    await db.set(videoId, videoDetails);

                    res.status(200).send({ videoId });
                } catch (error) {
                    res.status(500).send('Error saving video details to the database.');
                }
            })
            .on('error', (err) => {
                res.status(500).send('Error generating thumbnail.');
            });
    });
};

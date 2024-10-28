const { ensureAuthenticated } = require('../utils/util');
const db = require('../utils/db');
const path = require("path");

module.exports = (app, express) => {
    app.use('/files', express.static(path.join(__dirname, '../../', 'files')));

    app.get('/', async (req, res) => {
        try {
            const keys = await db.keys;
            const videos = [];
            
            for (const key of keys) {
                const video = await db.get(key);
                videos.push(video);
            }

            console.log(videos);

            res.render('index', { videos: videos, user: req.user });
        } catch (error) {
            console.error('Error fetching videos:', error);
            res.status(500).send('Error fetching videos');
        }
    });

    app.get('/login', (req, res) => {
        res.render('login', { user: req.user });
    });

    app.get('/video/:id', async (req, res) => {
        const videoId = req.params.id;

        try {
            const videoDetails = await db.get(videoId);

            if (!videoDetails) {
                return res.status(404).send('Video not found');
            }

            res.render('video', { user: req.user, video: videoDetails });
        } catch (error) {
            res.status(500).send('Error fetching video details: ' + error.message);
        }
    });

    app.get('/upload', ensureAuthenticated, (req, res) => {
        res.render('upload', { user: req.user });
    });
};

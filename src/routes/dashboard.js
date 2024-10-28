const db = require('../utils/db');
const { ensureAuthenticated } = require("../utils/util");
const AWS = require('aws-sdk');

// Initialize AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

module.exports = (app) => {
    app.get('/dashboard', ensureAuthenticated, async (req, res) => {
        if (!req.user.isStaff) {
            return res.status(403).send('Access denied.');
        }
      
        try {
            const keys = await db.keys;
            const videosToVerify = [];
        
            for (const key of keys) {
                const video = await db.get(key);
                if (!video.verified) {
                    videosToVerify.push({ key, value: video });
                }
            }
        
            res.render('dashboard', { user: req.user, videos: videosToVerify });
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error.');
        }
    });
      
    app.post('/dashboard/verify', ensureAuthenticated, async (req, res) => {
        const { videoId } = req.body;
      
        if (!videoId) {
            return res.status(400).send('No video ID provided.');
        }
      
        try {
            const videoDetails = await db.get(videoId);
      
            if (!videoDetails) {
                return res.status(404).send('Video not found.');
            }
      
            if (!req.user.isStaff) {
                return res.status(403).send('You do not have permission to verify videos.');
            }
      
            videoDetails.verified = true;
      
            await db.set(videoId, videoDetails);
      
            res.redirect('/dashboard');
        } catch (err) {
            console.error(err);
            res.status(500).send('Error verifying video.');
        }
    });

    app.delete('/dashboard/delete/:videoId', ensureAuthenticated, async (req, res) => {
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

            // Extract the key from the S3 URL
            // Example URL: https://your-bucket.s3.region.amazonaws.com/videos/filename.mp4
            const videoUrl = new URL(videoDetails.video);
            const videoKey = videoUrl.pathname.substring(1); // Remove leading slash
            const thumbnailKey = videoKey + '.png';

            // Delete video from S3
            await s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: videoKey
            }).promise();

            // Delete thumbnail from S3
            await s3.deleteObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: thumbnailKey
            }).promise();

            // Delete video entry from the database
            await db.delete(videoId);
            
            res.status(200).send('Video deleted successfully');
        } catch (error) {
            console.error('Error deleting video:', error);
            res.status(500).send('Error deleting video');
        }
    });
};

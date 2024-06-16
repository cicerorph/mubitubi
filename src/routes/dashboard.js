const db = require('../utils/db')
const { ensureAuthenticated } = require("../utils/util");

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
}
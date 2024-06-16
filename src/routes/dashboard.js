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
}
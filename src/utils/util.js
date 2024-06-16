const fs = require("fs");
const path = require('path');

const loadRoutes = async (app, express, routesDirectory, routeCount) => {
    fs.readdir(routesDirectory, (err, files) => {
      if (err) {
        console.error('Error reading routes directory:', err);
        return;
      }
  
      files.forEach((file) => {
        const filePath = path.join(routesDirectory, file);
        const stat = fs.statSync(filePath);
  
        if (stat.isDirectory()) {
          loadRoutes(app, express, filePath, routeCount);
        } else if (stat.isFile() && file.endsWith('.js')) {
          try {
              const route = require(filePath);
              route(app, express);
              routeCount++;
          } catch (error) {
            console.error(`Error loading route ${filePath}:`, error);
          }
        }
      });
    });
};

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }   
    // res.status(400).json({ error: "notLoggedIn", errorCode: 400 });
    res.redirect('/auth/discord');
};


module.exports = { loadRoutes, ensureAuthenticated };
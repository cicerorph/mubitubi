const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadRoutes } = require('./utils/util.js');
const db = require('./utils/db.js');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

let routeCount = 0;

const routesDirectory = path.join(__dirname, 'routes');

loadRoutes(app, express, routesDirectory, routeCount);

console.log(`[SERVER] Total routes loaded: ${routeCount}`);

app.use((req, res, next) => {
    console.log(`[LOG] ${req.ip} -> ${req.method} | ${req.path}`)
    next()
});

app.listen(port, () => {
    db.init()
    console.log(`[SERVER] Server is running on http://localhost:${port}`);
});
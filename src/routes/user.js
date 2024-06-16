const { ensureAuthenticated } = require("../utils/util");

module.exports = (app) => {
    app.get('/test', ensureAuthenticated, (req, res) => {
        res.send(req.user)
    });
}
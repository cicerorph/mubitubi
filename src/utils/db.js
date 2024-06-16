const Josh = require("@joshdb/core");
const provider = require("@joshdb/json");

const db = new Josh({
    name: 'mubitubidb',
    provider
});

module.exports = db;  
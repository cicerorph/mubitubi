const Josh = require("@joshdb/core");

const provider = require("@joshdb/json");

const db = new Josh({
    name: 'mubitubidb',
    provider: provider
});

(async() => {
    console.log(`Connected, there are ${await db.size} rows in the database.`);
})

module.exports = db;  
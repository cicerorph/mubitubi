const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true }, // Discord user ID
  username: String,
  global_name: String,
  discriminator: String,
  avatar: String,
  email: String,
  isStaff: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
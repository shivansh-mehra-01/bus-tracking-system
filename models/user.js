// models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roll: { type: String, enum: ["student", "driver"], required: true }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

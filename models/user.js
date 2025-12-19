// models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["student", "driver"],
      required: true
    },

    // ===== DRIVER ONLY FIELDS =====
    busNumber: {
      type: String,
      required: function () {
        return this.role === "driver";
      }
    },

    routeName: {
      type: String,
      required: function () {
        return this.role === "driver";
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

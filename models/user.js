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

    roll: {
      type: String,
      enum: ["student", "driver"],
      required: true
    },

    // ===== DRIVER ONLY FIELDS =====
    busNumber: {
      type: String,
      required: function () {
        return this.roll === "driver";
      }
    },

    routeName: {
      type: String,
      required: function () {
        return this.roll === "driver";
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

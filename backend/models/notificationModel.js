const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["login", "payment", "fine", "expense", "system", "general"],
      default: "general",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    link: {
      type: String,
      default: "",
    },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30,
    },
  },
  {
    timestamps: true,
  },
);

// MongoDB automatically removes notifications
// 30 days after createdAt.

module.exports = mongoose.model("Notification", notificationSchema);

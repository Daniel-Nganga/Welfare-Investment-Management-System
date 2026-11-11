const mongoose = require("mongoose");

const fineSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fineType: {
      type: String,
      enum: ["Attendance", "Lateness", "SACCO", "Conduct", "Other"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Partially Paid", "Paid"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

const Fine = mongoose.model("Fine", fineSchema);

module.exports = Fine;

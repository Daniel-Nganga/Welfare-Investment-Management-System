const mongoose = require("mongoose");

const finePaymentSchema = new mongoose.Schema(
  {
    fine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fine",
      required: true,
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Mpesa", "Bank"],
      required: true,
    },

    confirmationCode: {
      type: String,
      trim: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const FinePayment = mongoose.model("FinePayment", finePaymentSchema);

module.exports = FinePayment;

const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    expenseType: {
      type: String,
      enum: ["Transport", "Mission", "Stationery", "Medical", "Other"],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // how much came from each fund
    fundAllocation: {
      welfare: {
        type: Number,
        default: 0,
        min: 0,
      },

      fine: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Mpesa"],
      required: true,
    },

    confirmationCode: {
      type: String,
      trim: true,
    },

    expenseDate: {
      type: Date,
      default: Date.now,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Expense = mongoose.model("Expense", expenseSchema);

module.exports = Expense;

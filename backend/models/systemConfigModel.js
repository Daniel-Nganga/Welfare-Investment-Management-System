const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: "main",
      unique: true,
      required: true,
    },

    organizationName: {
      type: String,
      required: true,
      trim: true,
    },

    organizationEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    organizationPhone: {
      type: String,
      trim: true,
      default: "",
    },

    financialYear: {
      type: String,
      required: true,
      trim: true,
    },

    currency: {
      type: String,
      enum: ["KES"],
      default: "KES",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SystemConfig", systemConfigSchema);

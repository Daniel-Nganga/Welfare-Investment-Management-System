const mongose = require("mongoose");

const userSchema = new mongose.Schema(
  {
    memberNumber: {
      type: String,
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    dateJoined: {
      type: Date,
      default: new Date("2025-09-01"),
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    profilePicture: {
      type: String,
      default: "",
    },
    profilePicturePublicId: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const User = mongose.model("User", userSchema);
module.exports = User;

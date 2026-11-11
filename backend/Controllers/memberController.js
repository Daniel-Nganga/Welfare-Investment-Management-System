const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");

const storage = multer.memoryStorage();
// register a new member
exports.registerMember = async (req, res) => {
  try {
    const { memberNumber, fullName, phoneNumber, password } = req.body;

    // check if the member already exists
    const existingMember = await User.findOne({
      $or: [{ memberNumber }, { phoneNumber }],
    });

    if (existingMember) {
      return res
        .status(400)
        .json({ message: "Member number or phone number already exists" });
    }

    //    hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // create a new member
    const user = new User({
      memberNumber,
      fullName,
      phoneNumber,
      password: hashedPassword,
      role: "member",
    });
    await user.save();

    res.status(201).json({
      message: "Member registered successfully",
      user: {
        id: user._id,
        memberNumber: user.memberNumber,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error registering member", error: error.message });
  }
};

//get a Member

exports.getMember = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id });

    if (!user) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    res.status(200).json({
      message: "Member found",
      user,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching member", error: error.message });
  }
};

//get all members
exports.getAllMembers = async (req, res) => {
  try {
    const members = await User.find().sort({ createdAt: -1 });

    if (!members || members.length === 0) {
      return res.status(404).json({ message: "No members found" });
    }

    const formattedMembers = members.map((member) => ({
      id: member._id,
      memberNumber: member.memberNumber,
      fullName: member.fullName,
      phoneNumber: member.phoneNumber,
      role: member.role,
      status: member.status,
    }));

    res.status(200).json({
      message: "Members found",
      members: formattedMembers,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching members", error: error.message });
  }
};

//login a member
exports.loginMember = async (req, res) => {
  try {
    const { memberNumber, password } = req.body;

    //check if the member exists
    if (!memberNumber || !password) {
      return res.status(400).json({
        message: "Member number and password are required",
      });
    }

    //find  member

    const user = await User.findOne({ memberNumber });

    if (!user) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    //compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    //generate a JWT token
    const token = jwt.sign(
      {
        id: user._id,
        memberNumber: user.memberNumber,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.status(200).json({
      message: "Member logged in successfully",
      token,
      user: {
        id: user._id,
        memberNumber: user.memberNumber,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: " login failed", error: error.message });
  }
};

// ========================================
// UPDATE MEMBER PASSWORD
// ========================================
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Get logged-in user's ID from JWT middleware
    const userId = req.user.id;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "All password fields are required",
      });
    }

    // Check new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters",
      });
    }

    // Confirm new password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New passwords do not match",
      });
    }

    // Find logged-in member
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // Prevent using the same password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password update error:", error);

    return res.status(500).json({
      message: "Failed to update password",
      error: error.message,
    });
  }
};

// ========================================
// add profile picture
// ========================================

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image.",
      });
    }

    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Member not found.",
      });
    }

    // Upload image to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "welfare-investment/profiles",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      stream.end(req.file.buffer);
    });

    // Delete the previous Cloudinary image, if there is one
    if (user.profilePicturePublicId) {
      await cloudinary.uploader.destroy(user.profilePicturePublicId);
    }

    user.profilePicture = uploadResult.secure_url;
    user.profilePicturePublicId = uploadResult.public_id;

    await user.save();

    return res.status(200).json({
      message: "Profile picture updated successfully.",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);

    return res.status(500).json({
      message: "Failed to upload profile picture.",
      error: error.message,
    });
  }
};

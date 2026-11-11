const express = require("express");

const {
  registerMember,
  loginMember,
  getMember,
  getAllMembers,
  updatePassword,
  uploadProfilePicture,
} = require("../Controllers/memberController");
const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { profilePictureUpload } = require("../middleware/cloudinaryMiddleware");
const router = express.Router();

router.post("/register", registerMember);

router.post("/login", loginMember);
router.get("/all", getAllMembers);
router.get("/:id", getMember);
// UPDATE PASSWORD
router.put("/update-password", protectPayment, updatePassword);
/// profile picture upload
router.put(
  "/profile-picture",
  protectPayment,
  profilePictureUpload.single("profilePicture"),
  uploadProfilePicture,
);

module.exports = router;

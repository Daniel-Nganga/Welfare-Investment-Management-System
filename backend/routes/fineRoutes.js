const express = require("express");

const {
  addFine,
  getFines,
  getMyFines,
  getOneFine,
  getMemberFines,
  updateFine,
  deleteFine,
} = require("../Controllers/finesController");
const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const router = express.Router();

router.post("/add", protectPayment, adminOnly, addFine);
router.get("/all", protectPayment, adminOnly, getFines);

//get for logged in members to view their fines

router.get("/my-fines", protectPayment, getMyFines);
router.get("/member/:memberId", protectPayment, getMemberFines);

router.get("/:id", protectPayment, getOneFine);

router.put("/:id", protectPayment, adminOnly, updateFine);

router.delete("/delete/:id", protectPayment, adminOnly, deleteFine);

module.exports = router;

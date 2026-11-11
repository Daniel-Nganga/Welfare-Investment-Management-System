const express = require("express");
const router = express.Router();

const {
  getSystemConfig,
  updateSystemConfig,
} = require("../Controllers/systemConfigController");

const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

// Admin-only access
router.get("/settings", protectPayment, getSystemConfig);
router.put("/settings", protectPayment, adminOnly, updateSystemConfig);

module.exports = router;

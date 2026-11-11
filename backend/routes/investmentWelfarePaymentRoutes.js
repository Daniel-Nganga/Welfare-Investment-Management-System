const express = require("express");

const {
  addPayment,
  getPayments,
  getMemberPayment,
  getMyPayments,
  updatePayment,
  deletePayment,
} = require("../Controllers/investmentWelfarePaymentController");
const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/add", protectPayment, adminOnly, addPayment);
router.get("/all", protectPayment, adminOnly, getPayments);
router.get("/member", protectPayment, getMemberPayment);
// get my payments for logged in member
router.get("/my-payments", protectPayment, getMyPayments);
router.put("/:id", protectPayment, adminOnly, updatePayment);
router.delete("/:id", protectPayment, adminOnly, deletePayment);

module.exports = router;

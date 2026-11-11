const express = require("express");

const {
  PayFinePayment,
  getFinePayments,
  getMyFinePayments,
  getFinePaymentHistory,
  getMemberFinePayments,
  getFinePaymentById,
  updateFinePayment,
  deleteFinePayment,
} = require("../Controllers/finePaymentController");
const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");
const router = express.Router();
// Admin records a fine payment
router.post("/pay", protectPayment, adminOnly, PayFinePayment);
//Admin views all fine payments
router.get("/all", protectPayment, adminOnly, getFinePayments);
// View payments for a particular fine
router.get("/fine/:fineId", protectPayment, getFinePaymentHistory);
// View payments belonging to a member
router.get("/member/:memberId", protectPayment, getMemberFinePayments);

// View one payment
router.get("/:id", protectPayment, getFinePaymentById);

router.get("/my-fine-payments", protectPayment, getMyFinePayments);
router.put("/:id", protectPayment, adminOnly, updateFinePayment);

router.delete("/delete/:id", protectPayment, deleteFinePayment);

module.exports = router;

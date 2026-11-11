const express = require("express");

const {
  getDashboardReport,
  getPaymentReport,
  getFineReport,
  getExpenseReport,
  getFinancialSummary,
} = require("../Controllers/reportController");
const {
  getFineContributionReport,
  generateFinancialPDF,
  generateMonthlyContributionPDF,
  generateFineContributionPDF,
} = require("../Controllers/pdfReportController");
const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

// Dashboard
router.get("/dashboard", protectPayment, adminOnly, getDashboardReport);

// Payments
router.get("/payments", protectPayment, adminOnly, getPaymentReport);

// Fines
router.get("/fines", protectPayment, adminOnly, getFineReport);

// Expenses
router.get("/expenses", protectPayment, adminOnly, getExpenseReport);

// Financial summary
router.get(
  "/financial-summary",
  protectPayment,
  adminOnly,
  getFinancialSummary,
);

// Fine contribution JSON
router.get(
  "/fine-contributions",
  protectPayment,
  adminOnly,
  getFineContributionReport,
);
router.get("/combinepdf", protectPayment, adminOnly, generateFinancialPDF);
router.get(
  "/monthly-investment-welfare-contribution/pdf",
  protectPayment,
  adminOnly,
  generateMonthlyContributionPDF,
);

router.get(
  "/fine-contributions/pdf",
  protectPayment,
  adminOnly,
  generateFineContributionPDF,
);

module.exports = router;

const express = require("express");

const {
  getDashboardReport,
  getPaymentReport,
  getFineReport,
  getExpenseReport,
  getFinancialSummary,
  getMemberStatement,
  getOutstandingReport,
  getAttendanceReport,
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

// Payments (Supports ?type=Investment or ?type=Welfare & ?month=9&year=2025)
router.get("/payments", protectPayment, adminOnly, getPaymentReport);

// Fines
router.get("/fines", protectPayment, adminOnly, getFineReport);

// Expenses
router.get("/expenses", protectPayment, adminOnly, getExpenseReport);

// Financial summary (Monthly & Annual Reports)
router.get(
  "/financial-summary",
  protectPayment,
  adminOnly,
  getFinancialSummary,
);

// Member Statement
router.get(
  "/member-statement/:memberId",
  protectPayment,
  adminOnly,
  getMemberStatement,
);

// Outstanding Report
router.get("/outstanding", protectPayment, adminOnly, getOutstandingReport);

// Attendance Report
//router.get("/attendance", protectPayment, adminOnly, getAttendanceReport);

// Fine contribution JSON & PDFs
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

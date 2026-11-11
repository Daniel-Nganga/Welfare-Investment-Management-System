const express = require("express");

const {
  addExpense,
  getExpenses,
  getExpenseById,
  getWelfareExpenses,
  getFineExpenses,
  getFundBalances,
  updateExpense,
  deleteExpense,
} = require("../Controllers/expenseController");

const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/add", protectPayment, adminOnly, addExpense);

router.get("/all", protectPayment, adminOnly, getExpenses);

router.get("/fund-balances", protectPayment, adminOnly, getFundBalances);
// GET WELFARE-FUNDED EXPENSES
router.get("/fund/welfare", protectPayment, adminOnly, getWelfareExpenses);
//GET FINE-FUNDED EXPENSES
router.get("/fund/fine", protectPayment, adminOnly, getFineExpenses);

router.get("/:id", protectPayment, adminOnly, getExpenseById);

router.put("/:id", protectPayment, adminOnly, updateExpense);

router.delete("/:id", protectPayment, adminOnly, deleteExpense);

module.exports = router;

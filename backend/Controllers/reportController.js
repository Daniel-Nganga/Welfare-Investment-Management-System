const Expense = require("../models/ExpenseModel");
const User = require("../models/userModel");
const PaymentInvestmentWelfare = require("../models/InvestmentWelfarepaymentModel");
const FinePayment = require("../models/finePaymentModel");
const Fine = require("../models/FineModel");

// Helper for "Select Report Period" (e.g., ?month=9&year=2025)
const buildDateRange = (month, year, field) => {
  if (!year) return {};
  const parsedYear = Number(year);
  if (month) {
    const parsedMonth = Number(month);
    return {
      [field]: {
        $gte: new Date(parsedYear, parsedMonth - 1, 1),
        $lte: new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999),
      },
    };
  }
  return {
    [field]: {
      $gte: new Date(parsedYear, 0, 1),
      $lte: new Date(parsedYear, 11, 31, 23, 59, 59, 999),
    },
  };
};

// ==========================================
// 1. DASHBOARD REPORT
// ==========================================

exports.getDashboardReport = async (req, res) => {
  try {
    const investmentResult = await PaymentInvestmentWelfare.aggregate([
      { $match: { paymentType: "Investment" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalInvestment =
      investmentResult.length > 0 ? investmentResult[0].total : 0;

    const welfareResult = await PaymentInvestmentWelfare.aggregate([
      { $match: { paymentType: "Welfare" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWelfare = welfareResult.length > 0 ? welfareResult[0].total : 0;

    const fineResult = await FinePayment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFine = fineResult.length > 0 ? fineResult[0].total : 0;

    const expenseResult = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = expenseResult.length > 0 ? expenseResult[0].total : 0;

    const welfareExpenseResult = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$fundAllocation.welfare" } } },
    ]);
    const totalWelfareUsed =
      welfareExpenseResult.length > 0 ? welfareExpenseResult[0].total : 0;

    const fineExpenseResult = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$fundAllocation.fine" } } },
    ]);
    const totalFineUsed =
      fineExpenseResult.length > 0 ? fineExpenseResult[0].total : 0;

    const welfareBalance = totalWelfare - totalWelfareUsed;
    const fineBalance = totalFine - totalFineUsed;
    const totalAvailableFunds = welfareBalance + fineBalance;

    const totalMembers = await User.countDocuments();
    const activeMembers = await User.countDocuments({ status: "active" });
    const inactiveMembers = await User.countDocuments({ status: "inactive" });

    res.status(200).json({
      message: "Dashboard report retrieved successfully",
      members: {
        total: totalMembers,
        active: activeMembers,
        inactive: inactiveMembers,
      },
      payments: {
        investment: totalInvestment,
        welfare: totalWelfare,
        fine: totalFine,
      },
      expenses: {
        total: totalExpenses,
        welfareUsed: totalWelfareUsed,
        fineUsed: totalFineUsed,
      },
      funds: {
        welfareBalance,
        fineBalance,
        totalAvailable: totalAvailableFunds,
      },
      accountingNote: {
        investment:
          "Investment payments are SACCO funds and are not available for group expenses.",
        welfare: "Welfare payments are available for group expenses.",
        fine: "Fine payments are available for group expenses.",
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve dashboard report",
      error: error.message,
    });
  }
};

// ==========================================
// 2. PAYMENT REPORT
// ==========================================

exports.getPaymentReport = async (req, res) => {
  try {
    const { type, month, year } = req.query;
    const filter = {
      ...buildDateRange(month, year, "paymentDate"),
    };

    if (type) {
      filter.paymentType = type;
    }

    const payments = await PaymentInvestmentWelfare.find(filter)
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: -1 });

    const totalInvestment = payments
      .filter((payment) => payment.paymentType === "Investment")
      .reduce((total, payment) => total + payment.amount, 0);

    const totalWelfare = payments
      .filter((payment) => payment.paymentType === "Welfare")
      .reduce((total, payment) => total + payment.amount, 0);

    const totalPayments = totalInvestment + totalWelfare;

    res.status(200).json({
      message: "Payment report retrieved successfully",
      summary: {
        totalPayments,
        totalInvestment,
        totalWelfare,
      },
      payments,
    });
  } catch (error) {
    console.error("Payment Report Error:", error);
    res.status(500).json({
      message: "Failed to retrieve payment report",
      error: error.message,
    });
  }
};

// ==========================================
// 3. FINE REPORT
// ==========================================

exports.getFineReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const fineDateFilter = buildDateRange(month, year, "createdAt");
    const paymentDateFilter = buildDateRange(month, year, "paymentDate");

    const fineResult = await Fine.aggregate([
      { $match: fineDateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFinesIssued = fineResult.length > 0 ? fineResult[0].total : 0;

    const paymentResult = await FinePayment.aggregate([
      { $match: paymentDateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFinePayments =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    const outstandingFines = totalFinesIssued - totalFinePayments;

    const fines = await Fine.find(fineDateFilter)
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Fine report retrieved successfully",
      summary: {
        totalFinesIssued,
        totalFinePayments,
        outstandingFines,
      },
      fines,
    });
  } catch (error) {
    console.error("Fine Report Error:", error);
    res.status(500).json({
      message: "Failed to retrieve fine report",
      error: error.message,
    });
  }
};

// ==========================================
// 4. EXPENSE REPORT
// ==========================================

exports.getExpenseReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const expenseDateFilter = buildDateRange(month, year, "expenseDate");

    const expenses = await Expense.find(expenseDateFilter)
      .populate("recordedBy", "memberNumber fullName phoneNumber role")
      .sort({ expenseDate: -1 });

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );

    const totalWelfareUsed = expenses.reduce(
      (total, expense) => total + (expense.fundAllocation?.welfare || 0),
      0,
    );

    const totalFineUsed = expenses.reduce(
      (total, expense) => total + (expense.fundAllocation?.fine || 0),
      0,
    );

    res.status(200).json({
      message: "Expense report retrieved successfully",
      summary: {
        totalExpenses,
        totalWelfareUsed,
        totalFineUsed,
      },
      expenses,
    });
  } catch (error) {
    console.error("Expense Report Error:", error);
    res.status(500).json({
      message: "Failed to retrieve expense report",
      error: error.message,
    });
  }
};

// ==========================================
// 5. FINANCIAL SUMMARY
// ==========================================

exports.getFinancialSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const paymentDateFilter = buildDateRange(month, year, "paymentDate");
    const expenseDateFilter = buildDateRange(month, year, "expenseDate");

    const investmentResult = await PaymentInvestmentWelfare.aggregate([
      { $match: { paymentType: "Investment", ...paymentDateFilter } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalInvestment = investmentResult.length
      ? investmentResult[0].total
      : 0;

    const welfareResult = await PaymentInvestmentWelfare.aggregate([
      { $match: { paymentType: "Welfare", ...paymentDateFilter } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWelfare = welfareResult.length ? welfareResult[0].total : 0;

    const fineResult = await FinePayment.aggregate([
      { $match: paymentDateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalFine = fineResult.length ? fineResult[0].total : 0;

    const expenseResult = await Expense.aggregate([
      { $match: expenseDateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = expenseResult.length ? expenseResult[0].total : 0;

    const fundResult = await Expense.aggregate([
      { $match: expenseDateFilter },
      {
        $group: {
          _id: null,
          welfare: { $sum: "$fundAllocation.welfare" },
          fine: { $sum: "$fundAllocation.fine" },
        },
      },
    ]);

    const totalWelfareUsed = fundResult.length ? fundResult[0].welfare : 0;
    const totalFineUsed = fundResult.length ? fundResult[0].fine : 0;
    const welfareBalance = totalWelfare - totalWelfareUsed;
    const fineBalance = totalFine - totalFineUsed;
    res.status(200).json({
      message: "Financial summary retrieved successfully",
      investment: {
        total: totalInvestment,
        availableForExpenses: 0,
        note: "Investment is SACCO money and is not used for group expenses.",
      },
      welfare: {
        totalReceived: totalWelfare,
        totalUsed: totalWelfareUsed,
        balance: welfareBalance,
      },
      fines: {
        totalReceived: totalFine,
        totalUsed: totalFineUsed,
        balance: fineBalance,
      },
      expenses: {
        total: totalExpenses,
      },
      groupFunds: {
        totalReceived: totalWelfare + totalFine,
        totalUsed: totalWelfareUsed + totalFineUsed,
        balance: welfareBalance + fineBalance,
      },
    });
  } catch (error) {
    console.error("Financial Summary Error:", error);
    res.status(500).json({
      message: "Failed to retrieve financial summary",
      error: error.message,
    });
  }
};
// ==========================================
// 6. MEMBER STATEMENT
// ==========================================
exports.getMemberStatement = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { month, year } = req.query;
    const paymentDateFilter = buildDateRange(month, year, "paymentDate");
    const fineDateFilter = buildDateRange(month, year, "createdAt");
    const [member, payments, fines, finePayments] = await Promise.all([
      User.findById(memberId).select(
        "memberNumber fullName phoneNumber status",
      ),
      PaymentInvestmentWelfare.find({
        member: memberId,
        ...paymentDateFilter,
      }).sort({ paymentDate: -1 }),
      Fine.find({
        member: memberId,
        ...fineDateFilter,
      }).sort({ createdAt: -1 }),
      FinePayment.find({
        member: memberId,
        ...paymentDateFilter,
      }).sort({ paymentDate: -1 }),
    ]);
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.status(200).json({
      message: "Member statement retrieved successfully",
      member,
      payments,
      fines,
      finePayments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve member statement",
      error: error.message,
    });
  }
};
// ==========================================
// 7. OUTSTANDING REPORT
// ==========================================
exports.getOutstandingReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const members = await User.find({ status: "active" }).select(
      "memberNumber fullName phoneNumber",
    );
    const payments = await PaymentInvestmentWelfare.find(
      buildDateRange(month, year, "paymentDate"),
    );
    const unpaidFines = await Fine.find({ status: { $ne: "paid" } }).populate(
      "member",
      "memberNumber fullName",
    );
    const paidMemberIds = new Set(payments.map((p) => String(p.member)));
    const unpaidMembers = members.filter(
      (m) => !paidMemberIds.has(String(m._id)),
    );
    res.status(200).json({
      message: "Outstanding report retrieved successfully",
      unpaidMembers,
      unpaidFines,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve outstanding report",
      error: error.message,
    });
  }
};

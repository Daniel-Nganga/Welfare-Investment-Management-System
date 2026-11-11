const Expense = require("../models/ExpenseModel");
const User = require("../models/userModel");
const Payment = require("../models/InvestmentWelfarepaymentModel");
const FinePayment = require("../models/finePaymentModel");
const { createNotification } = require("./notificationController");

// GET CURRENT WELFARE AND FINE BALANCES
// =====================================================

const getFundBalances = async () => {
  // TOTAL WELFARE PAYMENTS

  const welfarePayments = await Payment.aggregate([
    {
      $match: {
        paymentType: "Welfare",
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$amount",
        },
      },
    },
  ]);

  const totalWelfare =
    welfarePayments.length > 0 ? welfarePayments[0].total : 0;

  // TOTAL WELFARE USED IN EXPENSES
  // ------------------------------------------

  const welfareExpenses = await Expense.aggregate([
    {
      $group: {
        _id: null,
        total: {
          $sum: "$fundAllocation.welfare",
        },
      },
    },
  ]);

  const totalWelfareExpenses =
    welfareExpenses.length > 0 ? welfareExpenses[0].total : 0;

  // WELFARE BALANCE
  // ------------------------------------------

  const welfareBalance = totalWelfare - totalWelfareExpenses;

  // ------------------------------------------
  // TOTAL FINE PAYMENTS
  // ------------------------------------------

  const finePayments = await FinePayment.aggregate([
    {
      $group: {
        _id: null,
        total: {
          $sum: "$amount",
        },
      },
    },
  ]);

  const totalFine = finePayments.length > 0 ? finePayments[0].total : 0;

  // ------------------------------------------
  // TOTAL FINE MONEY USED IN EXPENSES
  // ------------------------------------------

  const fineExpenses = await Expense.aggregate([
    {
      $group: {
        _id: null,
        total: {
          $sum: "$fundAllocation.fine",
        },
      },
    },
  ]);

  const totalFineExpenses = fineExpenses.length > 0 ? fineExpenses[0].total : 0;

  // ------------------------------------------
  // FINE BALANCE
  // ------------------------------------------

  const fineBalance = totalFine - totalFineExpenses;

  return {
    totalWelfare,
    totalWelfareExpenses,
    welfareBalance,

    totalFine,
    totalFineExpenses,
    fineBalance,

    totalAvailable: welfareBalance + fineBalance,
  };
};

// =====================================================
//add Expense

// =====================================================
exports.addExpense = async (req, res) => {
  try {
    const {
      expenseType,
      description,
      amount,
      paymentMethod,
      confirmationCode,
    } = req.body;
    const memberId = req.user.id;

    if (
      !expenseType ||
      !description ||
      amount === undefined ||
      !paymentMethod
    ) {
      return res.status(400).json({
        message:
          "Expense type, description, amount and payment method are required",
      });
    }

    //  VALIDATE AMOUNT
    // ------------------------------------------
    if (amount <= 0) {
      return res.status(400).json({
        message: "Expense amount must be greater than 0",
      });
    }

    // getting the current balances
    const balance = await getFundBalances();

    const welfareBalance = balance.welfareBalance;
    const fineBalance = balance.fineBalance;

    // CHECK TOTAL AVAILABLE MONEY
    // ------------------------------------------

    const totalAvailable = welfareBalance + fineBalance;

    if (totalAvailable < amount) {
      return res.status(400).json({
        message: "Insufficient funds for this expense",
        expenseAmount: amount,
        balances: {
          welfareBalance,
          fineBalance,
          totalAvailable,
        },

        shortage: amount - totalAvailable,
      });
    }

    // AUTOMATIC FUND ALLOCATION
    // =================================================

    let welfareUsed = 0;
    let fineUsed = 0;

    // WELFARE ALONE CAN PAY
    // ------------------------------------------

    if (welfareBalance >= amount) {
      welfareUsed = amount;

      fineUsed = 0;
    }

    // ------------------------------------------

    // WELFARE + FINE MUST BE COMBINED
    // ------------------------------------------
    else {
      // Use all available Welfare
      welfareUsed = welfareBalance;

      // Remaining amount needed
      const remainingAmount = amount - welfareUsed;

      // Use the remaining amount from Fine
      fineUsed = remainingAmount;
    }

    // ------------------------------------------
    // SAFETY CHECK
    // ------------------------------------------

    const allocatedAmount = welfareUsed + fineUsed;

    if (allocatedAmount !== amount) {
      return res.status(400).json({
        message: "Unable to allocate funds correctly",
      });
    }
    // CREATE EXPENSE
    const expense = await Expense.create({
      expenseType,
      description,
      amount,
      fundAllocation: {
        welfare: welfareUsed,
        fine: fineUsed,
      },
      paymentMethod,
      confirmationCode,

      recordedBy: req.user.id,
    });

    // POPULATE RECORDED BY

    const populatedExpense = await Expense.findById(expense._id).populate(
      "recordedBy",
      "memberNumber fullName phoneNumber role",
    );

    // ------------------------------------------
    // 12. CALCULATE NEW BALANCE
    // ------------------------------------------
    const newWelfareBalance = welfareBalance - welfareUsed;

    const newFineBalance = fineBalance - fineUsed;

    // ------------------------------------------
    // 13. SEND RESPONSE
    // ------------------------------------------
    res.status(201).json({
      message: "Expense recorded successfully",

      expense: populatedExpense,

      automaticAllocation: {
        welfare: welfareUsed,
        fine: fineUsed,
        total: allocatedAmount,
      },

      balances: {
        welfareBalance: newWelfareBalance,
        fineBalance: newFineBalance,
        totalAvailable: newWelfareBalance + newFineBalance,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add expense",
      error: error.message,
    });
  }
};

// ==========================================

// GET ALL EXPENSES
// =====================================================

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate("recordedBy", "memberNumber fullName phoneNumber role")
      .sort({
        expenseDate: -1,
      });

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );

    const totalWelfareUsed = expenses.reduce(
      (total, expense) => total + expense.fundAllocation.welfare,
      0,
    );

    const totalFineUsed = expenses.reduce(
      (total, expense) => total + expense.fundAllocation.fine,
      0,
    );

    res.status(200).json({
      message: "Expenses retrieved successfully",

      count: expenses.length,

      totalExpenses,

      totalWelfareUsed,

      totalFineUsed,

      expenses,
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);

    res.status(500).json({
      message: "Failed to retrieve expenses",

      error: error.message,
    });
  }
};

// =====================================================
// GET ONE EXPENSE
// =====================================================

exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id).populate(
      "recordedBy",
      "memberNumber fullName phoneNumber role",
    );

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    res.status(200).json({
      message: "Expense retrieved successfully",

      expense,
    });
  } catch (error) {
    console.error("Get Expense Error:", error);

    res.status(500).json({
      message: "Failed to retrieve expense",

      error: error.message,
    });
  }
};

// =====================================================
// GET EXPENSES FUNDED BY WELFARE
// =====================================================

exports.getWelfareExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({
      "fundAllocation.welfare": { $gt: 0 },
    })
      .populate("recordedBy", "memberNumber fullName phoneNumber role")
      .sort({
        expenseDate: -1,
      });

    const totalWelfareUsed = expenses.reduce(
      (total, expense) => total + expense.fundAllocation.welfare,
      0,
    );

    res.status(200).json({
      message: "Welfare-funded expenses retrieved successfully",

      count: expenses.length,

      totalWelfareUsed,

      expenses,
    });
  } catch (error) {
    console.error("Get Welfare Expenses Error:", error);

    res.status(500).json({
      message: "Failed to retrieve Welfare expenses",

      error: error.message,
    });
  }
};

// =====================================================
// GET EXPENSES FUNDED BY FINE
// =====================================================

exports.getFineExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({
      "fundAllocation.fine": { $gt: 0 },
    })
      .populate("recordedBy", "memberNumber fullName phoneNumber role")
      .sort({
        expenseDate: -1,
      });

    const totalFineUsed = expenses.reduce(
      (total, expense) => total + expense.fundAllocation.fine,
      0,
    );

    res.status(200).json({
      message: "Fine-funded expenses retrieved successfully",

      count: expenses.length,

      totalFineUsed,

      expenses,
    });
  } catch (error) {
    console.error("Get Fine Expenses Error:", error);

    res.status(500).json({
      message: "Failed to retrieve Fine expenses",

      error: error.message,
    });
  }
};

// =====================================================
// GET CURRENT FUND BALANCES
// =====================================================

exports.getFundBalances = async (req, res) => {
  try {
    const balances = await getFundBalances();

    res.status(200).json({
      message: "Fund balances retrieved successfully",

      funds: balances,
    });
  } catch (error) {
    console.error("Get Fund Balances Error:", error);

    res.status(500).json({
      message: "Failed to retrieve fund balances",

      error: error.message,
    });
  }
};

// =====================================================
// UPDATE EXPENSE
// =====================================================

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      expenseType,
      description,
      amount,
      paymentMethod,
      confirmationCode,
      expenseDate,
    } = req.body;

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    if (expenseType !== undefined) {
      expense.expenseType = expenseType;
    }

    if (description !== undefined) {
      expense.description = description;
    }

    if (paymentMethod !== undefined) {
      expense.paymentMethod = paymentMethod;
    }

    if (confirmationCode !== undefined) {
      expense.confirmationCode = confirmationCode;
    }

    if (expenseDate !== undefined) {
      expense.expenseDate = expenseDate;
    }

    /*
      IMPORTANT:

      If amount changes, the fund allocation
      must also be recalculated.

      We remove the old expense temporarily
      from the balance calculation and then
      calculate the new allocation.
    */

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          message: "Expense amount must be a number greater than 0",
        });
      }

      // Get all other expenses
      const otherExpenses = await Expense.find({
        _id: {
          $ne: id,
        },
      });

      const totalWelfare = await Payment.aggregate([
        {
          $match: {
            paymentType: "Welfare",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

      const totalFine = await FinePayment.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

      const welfareIncome = totalWelfare.length ? totalWelfare[0].total : 0;

      const fineIncome = totalFine.length ? totalFine[0].total : 0;

      const welfareUsed = otherExpenses.reduce(
        (total, item) => total + item.fundAllocation.welfare,
        0,
      );

      const fineUsed = otherExpenses.reduce(
        (total, item) => total + item.fundAllocation.fine,
        0,
      );

      const welfareBalance = welfareIncome - welfareUsed;

      const fineBalance = fineIncome - fineUsed;

      if (welfareBalance + fineBalance < amount) {
        return res.status(400).json({
          message: "Insufficient funds to update this expense",

          welfareBalance,
          fineBalance,

          totalAvailable: welfareBalance + fineBalance,
        });
      }

      let newWelfareUsed = 0;
      let newFineUsed = 0;

      if (welfareBalance >= amount) {
        newWelfareUsed = amount;
      } else {
        newWelfareUsed = welfareBalance;

        newFineUsed = amount - welfareBalance;
      }

      expense.amount = amount;

      expense.fundAllocation = {
        welfare: newWelfareUsed,

        fine: newFineUsed,
      };
    }

    await expense.save();

    const updatedExpense = await Expense.findById(id).populate(
      "recordedBy",
      "memberNumber fullName phoneNumber role",
    );

    res.status(200).json({
      message: "Expense updated successfully",

      expense: updatedExpense,
    });
  } catch (error) {
    console.error("Update Expense Error:", error);

    res.status(500).json({
      message: "Failed to update expense",

      error: error.message,
    });
  }
};

// =====================================================
// DELETE EXPENSE
// =====================================================

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    await Expense.findByIdAndDelete(id);

    res.status(200).json({
      message: "Expense deleted successfully",

      returnedToFunds: {
        welfare: expense.fundAllocation.welfare,

        fine: expense.fundAllocation.fine,
      },
    });
  } catch (error) {
    console.error("Delete Expense Error:", error);

    res.status(500).json({
      message: "Failed to delete expense",

      error: error.message,
    });
  }
};

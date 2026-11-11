const User = require("../models/userModel");
const Fine = require("../models/FineModel");
const FinePayment = require("../models/finePaymentModel");
const { createNotification } = require("./notificationController");

// REGISTER FINE PAYMENT

exports.PayFinePayment = async (req, res) => {
  try {
    const {
      fine,
      fineId,
      memberNumber,
      amount,
      paymentMethod,
      confirmationCode,
    } = req.body;

    const selectedFineId = fineId || fine;

    // Validate required fields.
    if (
      !selectedFineId ||
      !memberNumber ||
      amount === undefined ||
      !paymentMethod ||
      !confirmationCode?.trim()
    ) {
      return res.status(400).json({
        message:
          "Fine, member number, amount, payment method and confirmation code are required.",
      });
    }
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        message: "Payment amount must be greater than zero.",
      });
    }

    if (!["Cash", "Mpesa"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method.",
      });
    }

    // M-Pesa confirmation codes are required for M-Pesa payments.
    // For cash payments, require a receipt/reference code if that is
    // your group's accounting policy.
    if (paymentMethod === "Mpesa" && !confirmationCode.trim()) {
      return res.status(400).json({
        message: "M-Pesa confirmation code is required.",
      });
    }

    // Find the member.
    const member = await User.findOne({ memberNumber });

    if (!member) {
      return res.status(404).json({
        message: "Member not found.",
      });
    }

    // Find the fine and verify that it belongs to this member.
    const existingFine = await Fine.findOne({
      _id: selectedFineId,
      member: member._id,
    });

    if (!existingFine) {
      return res.status(404).json({
        message: "Fine not found for this member.",
      });
    }

    // Calculate the outstanding balance.
    const previousPayments = await FinePayment.find({
      fine: existingFine._id,
    });

    const totalPaid = previousPayments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );

    const balance = Math.max(0, existingFine.amount - totalPaid);

    if (balance <= 0) {
      return res.status(400).json({
        message: "This fine has already been fully paid.",
      });
    }

    if (paymentAmount > balance) {
      return res.status(400).json({
        message: `Payment exceeds the outstanding balance of KSh ${balance.toFixed(2)}.`,
        outstandingBalance: balance,
      });
    }

    // Record the payment using the original confirmation code.
    const payment = await FinePayment.create({
      fine: existingFine._id,
      member: member._id,
      amount: paymentAmount,
      paymentMethod,
      confirmationCode: confirmationCode.trim(),
    });
    // Notify the member after successful payment.
    await createNotification({
      recipient: payment.member,
      title: "Fine Payment Received",
      message: `Your fine payment of KSh ${Number(
        paymentAmount,
      ).toLocaleString()} has been recorded successfully.
  
      confirmationCode: ${confirmationCode.trim()},
      `,
    });

    // Update the fine status.
    const newTotalPaid = totalPaid + paymentAmount;

    if (newTotalPaid >= existingFine.amount) {
      existingFine.paymentStatus = "Paid";
    } else {
      existingFine.paymentStatus = "Partially Paid";
    }

    await existingFine.save();

    return res.status(201).json({
      message: "Fine payment recorded successfully.",
      payment,
      fine: {
        _id: existingFine._id,
        amount: existingFine.amount,
        totalPaid: newTotalPaid,
        outstandingBalance: existingFine.amount - newTotalPaid,
        paymentStatus: existingFine.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Add Fine Payment Error:", error);

    return res.status(500).json({
      message: "Failed to register fine payment.",
      error: error.message,
    });
  }
};

// ======================================
// GET ALL FINE PAYMENTS
// ======================================
exports.getFinePayments = async (req, res) => {
  try {
    const payments = await FinePayment.find()
      .populate("member", "memberNumber fullName phoneNumber")
      .populate("fine", "fineType amount paymentStatus")
      .sort({ paymentDate: -1 });

    res.status(200).json({
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Get Fine Payments Error:", error);

    res.status(500).json({
      message: "Failed to get fine payments",
      error: error.message,
    });
  }
};

// ======================================
// GET PAYMENTS FOR ONE FINE
// ======================================
exports.getFinePaymentHistory = async (req, res) => {
  try {
    const { fineId } = req.params;

    const fine = await Fine.findById(fineId);

    if (!fine) {
      return res.status(404).json({
        message: "Fine not found",
      });
    }

    const payments = await FinePayment.find({
      fine: fineId,
    })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );

    const balance = fine.amount - totalPaid;

    res.status(200).json({
      fine: {
        id: fine._id,
        fineType: fine.fineType,
        amount: fine.amount,
        paymentStatus: fine.paymentStatus,
      },

      summary: {
        totalFine: fine.amount,
        totalPaid,
        balance,
      },

      payments,
    });
  } catch (error) {
    console.error("Fine Payment History Error:", error);

    res.status(500).json({
      message: "Failed to get fine payment history",
      error: error.message,
    });
  }
};

// ======================================
// GET PAYMENTS FOR ONE MEMBER
// ======================================
exports.getMemberFinePayments = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Member can only see their own payments
    if (req.user.role !== "admin" && req.user.id !== memberId) {
      return res.status(403).json({
        message: "You can only view your own fine payments",
      });
    }
    const member = await User.findById(memberId);

    if (!member) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    const payments = await FinePayment.find({
      member: memberId,
    })
      .populate("fine", "fineType amount paymentStatus")
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );

    res.status(200).json({
      member: {
        id: member._id,
        memberNumber: member.memberNumber,
        fullName: member.fullName,
      },

      totalPayments: payments.length,
      totalPaid,

      payments,
    });
  } catch (error) {
    console.error("Get Member Fine Payments Error:", error);

    res.status(500).json({
      message: "Failed to get member fine payments",
      error: error.message,
    });
  }
};

// ======================================
// GET ONE FINE PAYMENT
// ======================================
exports.getFinePaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await FinePayment.findById(id)
      .populate("member", "memberNumber fullName phoneNumber")
      .populate("fine", "fineType amount paymentStatus");

    if (!payment) {
      return res.status(404).json({
        message: "Fine payment not found",
      });
    }

    res.status(200).json({
      payment,
    });
  } catch (error) {
    console.error("Get Fine Payment Error:", error);

    res.status(500).json({
      message: "Failed to get fine payment",
      error: error.message,
    });
  }
};

// GET fine payments for the logged-in member
// ======================================
exports.getMyFinePayments = async (req, res) => {
  try {
    const payments = await FinePayment.find({
      member: req.user.id,
    })
      .populate("fine", "fineType amount paymentStatus")
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );

    res.status(200).json({
      message: "Your fine payments retrieved successfully",
      count: payments.length,
      totalPaid,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve your fine payments",
      error: error.message,
    });
  }
};

// DELETE FINE PAYMENT
exports.deleteFinePayment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the payment
    const payment = await FinePayment.findById(id);

    if (!payment) {
      return res.status(404).json({
        message: "Fine payment not found",
      });
    }

    // Find the fine associated with this payment
    const fine = await Fine.findById(payment.fine);

    if (!fine) {
      return res.status(404).json({
        message: "Associated fine not found",
      });
    }

    // Delete the payment
    await FinePayment.findByIdAndDelete(id);

    // Calculate remaining payments
    const payments = await FinePayment.find({
      fine: fine._id,
    });

    const totalPaid = payments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0,
    );

    // Recalculate payment status
    let paymentStatus = "Pending";

    if (totalPaid >= fine.amount) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partially Paid";
    }

    // Update fine status
    fine.paymentStatus = paymentStatus;
    await fine.save();

    res.status(200).json({
      message: "Fine payment deleted successfully",
      totalPaid,
      remainingBalance: Math.max(0, fine.amount - totalPaid),
      paymentStatus,
    });
  } catch (error) {
    console.error("Delete Fine Payment Error:", error);

    res.status(500).json({
      message: "Failed to delete fine payment",
      error: error.message,
    });
  }
};

// ======================================
// UPDATE FINE PAYMENT
// ======================================
exports.updateFinePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, confirmationCode } = req.body;

    const payment = await FinePayment.findById(id);

    if (!payment) {
      return res.status(404).json({
        message: "Fine payment not found",
      });
    }

    const fine = await Fine.findById(payment.fine);

    if (!fine) {
      return res.status(404).json({
        message: "Associated fine not found",
      });
    }

    // Validate amount
    if (amount !== undefined) {
      const newAmount = Number(amount);

      if (!Number.isFinite(newAmount) || newAmount <= 0) {
        return res.status(400).json({
          message: "Payment amount must be greater than zero",
        });
      }

      // Total payments excluding the payment being edited
      const otherPayments = await FinePayment.find({
        fine: fine._id,
        _id: { $ne: payment._id },
      });

      const otherTotal = otherPayments.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      );

      if (otherTotal + newAmount > fine.amount) {
        return res.status(400).json({
          message: "Payment exceeds the outstanding fine balance",
          outstandingBalance: Math.max(0, fine.amount - otherTotal),
        });
      }

      payment.amount = newAmount;
    }

    if (paymentMethod !== undefined) {
      if (!["Cash", "Mpesa"].includes(paymentMethod)) {
        return res.status(400).json({
          message: "Invalid payment method",
        });
      }

      payment.paymentMethod = paymentMethod;
    }

    if (confirmationCode !== undefined) {
      if (!confirmationCode.trim()) {
        return res.status(400).json({
          message: "Confirmation code is required",
        });
      }

      payment.confirmationCode = confirmationCode.trim();
    }

    await payment.save();

    // Recalculate the fine's payment status
    const payments = await FinePayment.find({
      fine: fine._id,
    });

    const totalPaid = payments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0,
    );

    if (totalPaid >= fine.amount) {
      fine.paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      fine.paymentStatus = "Partially Paid";
    } else {
      fine.paymentStatus = "Pending";
    }

    await fine.save();

    const updatedPayment = await FinePayment.findById(id)
      .populate("member", "memberNumber fullName phoneNumber")
      .populate("fine", "fineType amount paymentStatus");

    return res.status(200).json({
      message: "Fine payment updated successfully",
      payment: updatedPayment,
      totalPaid,
      outstandingBalance: Math.max(0, fine.amount - totalPaid),
      paymentStatus: fine.paymentStatus,
    });
  } catch (error) {
    console.error("Update Fine Payment Error:", error);

    return res.status(500).json({
      message: "Failed to update fine payment",
      error: error.message,
    });
  }
};

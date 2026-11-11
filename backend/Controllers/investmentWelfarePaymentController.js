const Payment = require("../models/InvestmentWelfarepaymentModel");
const User = require("../models/userModel");
const { createNotification } = require("./notificationController");

exports.addPayment = async (req, res) => {
  try {
    const {
      memberNumber,
      paymentType,
      amount,
      paymentMethod,
      confirmationCode,
    } = req.body;

    // Validate required fields
    if (
      !memberNumber ||
      !paymentType ||
      amount === undefined ||
      !paymentMethod
    ) {
      return res.status(400).json({
        message: "Please provide all required payment details",
      });
    }

    // Check if the member exists

    const member = await User.findOne({ memberNumber });
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // If payment method is Mpesa, confirmation code is required
    if (paymentMethod === "Mpesa" && !confirmationCode) {
      return res.status(400).json({
        message: "Mpesa confirmation code is required",
      });
    }

    // create a new payment record
    const payment = await Payment.create({
      member: member._id,
      paymentType,
      amount,
      paymentMethod,
      confirmationCode,
    });
    // Notify the member after successful saving
    await createNotification({
      recipient: payment.member,
      title: "Contribution Received",
      message: `Your ${paymentType} contribution of KSh ${Number(
        amount,
      ).toLocaleString()} has been recorded successfully.`,
      Paymenttype: paymentType,
      ConfirmationCode: confirmationCode,
    });
    res.status(201).json({
      message: "Payment recorded successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to record payment",
      error: error.message,
    });
  }
};

///Get all payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: -1 });

    res.status(200).json({
      message: "Payments retrieved successfully",
      count: payments.length,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve payments",
      error: error.message,
    });
  }
};

// GET PAYMENTS FOR ONE MEMBER
// ===============================

exports.getMemberPayment = async (req, res) => {
  try {
    const memberId = req.user.id;

    const member = await User.findById(memberId);

    if (!member || member.length === 0) {
      return res.status(404).json({
        message: " No payments found for this member",
      });
    }

    const memberPayments = await Payment.find({ member: memberId })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: -1 });

    res.status(200).json({
      message: "Member payments retrieved successfully",
      count: memberPayments.length,
      member: {
        id: member._id,
        memberNumber: member.memberNumber,
        fullName: member.fullName,
        phoneNumber: member.phoneNumber,
      },
      memberPayments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve member payments",
    });
  }
};

// get my payments for logged in member

exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      member: req.user.id,
    })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );

    res.status(200).json({
      message: "Your payments retrieved successfully",
      count: payments.length,
      totalPaid,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve member payments",
      error: error.message,
    });
  }
};

// update payment

exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentType, amount, paymentMethod, confirmationCode } = req.body;

    if (!require("mongoose").isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // This page manages Investment payments only
    if (payment.paymentType !== "Investment") {
      return res.status(400).json({
        message: "Only Investment payments can be edited here",
      });
    }

    if (paymentType !== undefined && paymentType !== "Investment") {
      return res.status(400).json({
        message: "Payment type must remain Investment",
      });
    }

    if (amount !== undefined) {
      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          message: "Amount must be greater than zero",
        });
      }

      payment.amount = numericAmount;
    }

    if (paymentMethod !== undefined) {
      if (!["Cash", "Mpesa"].includes(paymentMethod)) {
        return res.status(400).json({
          message: "Payment method must be Cash or Mpesa",
        });
      }

      payment.paymentMethod = paymentMethod;
    }

    if (confirmationCode !== undefined) {
      payment.confirmationCode = confirmationCode.trim();
    }

    if (
      payment.paymentMethod === "Mpesa" &&
      !payment.confirmationCode?.trim()
    ) {
      return res.status(400).json({
        message: "Mpesa confirmation code is required",
      });
    }

    await payment.save();

    const updatedPayment = await Payment.findById(payment._id).populate(
      "member",
      "memberNumber fullName phoneNumber",
    );

    return res.status(200).json({
      message: "Payment updated successfully",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Update payment error:", error);

    return res.status(500).json({
      message: "Failed to update payment",
      error: error.message,
    });
  }
};

// Delete  payments

exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!require("mongoose").isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    await Payment.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Investment payment deleted successfully",
      paymentId: id,
    });
  } catch (error) {
    console.error("Delete payment error:", error);

    return res.status(500).json({
      message: "Failed to delete payment",
      error: error.message,
    });
  }
};

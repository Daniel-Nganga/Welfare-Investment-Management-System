const User = require("../models/userModel");
const Fine = require("../models/FineModel");
const FinePayment = require("../models/finePaymentModel");
const { createNotification } = require("./notificationController");

//CREATE / REGISTER FINE
exports.addFine = async (req, res) => {
  try {
    const { memberNumber, fineType, amount, description, paymentStatus } =
      req.body;

    // Validate required fields
    if (!memberNumber || !fineType || amount === undefined) {
      return res.status(400).json({
        message: "Member number, fine type and amount are required.",
      });
    }

    if (
      !["Attendance", "Lateness", "SACCO", "Conduct", "Other"].includes(
        fineType,
      )
    ) {
      return res.status(400).json({
        message: "Invalid fine type.",
      });
    }

    const fineAmount = Number(amount);

    if (!Number.isFinite(fineAmount) || fineAmount <= 0) {
      return res.status(400).json({
        message: "Fine amount must be greater than zero.",
      });
    }

    if (
      paymentStatus &&
      !["Pending", "Partially Paid", "Paid"].includes(paymentStatus)
    ) {
      return res.status(400).json({
        message: "Invalid payment status.",
      });
    }

    if (fineType === "Other" && !description?.trim()) {
      return res.status(400).json({
        message: "Description is required for an Other fine.",
      });
    }

    // Find member using their member number, not MongoDB _id
    const member = await User.findOne({
      memberNumber: memberNumber.trim(),
    });

    if (!member) {
      return res.status(404).json({
        message: "Member not found. Check the member number.",
      });
    }

    // Create fine
    // A new fine starts Pending until an actual payment is recorded.
    const fine = await Fine.create({
      member: member._id,
      fineType,
      amount: fineAmount,
      description: description?.trim() || "",
      paymentStatus: "Pending",
    });

    // Create a notification for the member
    await createNotification({
      recipient: fine.member,
      title: "New Fine Recorded",
      message: `A ${fineType} fine of KSh ${Number(
        fineAmount,
      ).toLocaleString()} has been recorded against your account.
      Description: ${description || "No description provided."}
      `,
    });

    const populatedFine = await Fine.findById(fine._id).populate(
      "member",
      "memberNumber fullName phoneNumber",
    );

    return res.status(201).json({
      message: "Fine added successfully.",
      fine: populatedFine,
    });
  } catch (error) {
    console.error("Add fine error:", error);

    return res.status(500).json({
      message: "Failed to add fine.",
      error: error.message,
    });
  }
};

// ==============================
// GET ALL FINES
// ==============================
exports.getFines = async (req, res) => {
  try {
    const fines = await Fine.find()
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Fines retrieved successfully",
      count: fines.length,
      fines,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve fines",
      error: error.message,
    });
  }
};

// ==============================
// GET ONE FINE
// ==============================
exports.getOneFine = async (req, res) => {
  try {
    const { id } = req.params;

    const fine = await Fine.findById(id).populate(
      "member",
      "memberNumber fullName phoneNumber",
    );

    if (!fine) {
      return res.status(404).json({ message: "Fine not found" });
    }

    res.status(200).json({
      message: "Fine retrieved successfully",
      fine,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve fine",
      error: error.message,
    });
  }
};

// ==============================
// GET FINES FOR ONE MEMBER
// ==============================

exports.getMemberFines = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Members can only view their own fines
    if (req.user.role !== "admin" && req.user.id !== memberId) {
      return res.status(403).json({
        message: "You can only view your own fines",
      });
    }

    // Check if the member exists
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const fines = await Fine.find({ member: memberId })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Member fines retrieved successfully",
      member: {
        id: member._id,
        memberNumber: member.memberNumber,
        fullName: member.fullName,
      },
      count: fines.length,
      fines,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve member fines",
      error: error.message,
    });
  }
};

// ==============================
// UPDATE FINE
// ==============================

exports.updateFine = async (req, res) => {
  try {
    const { id } = req.params;
    const { fineType, amount, description } = req.body;

    const fine = await Fine.findById(id);

    if (!fine) {
      return res.status(404).json({
        message: "Fine not found",
      });
    }

    // Validate fine type
    if (
      fineType !== undefined &&
      !["Attendance", "Lateness", "SACCO", "Conduct", "Other"].includes(
        fineType,
      )
    ) {
      return res.status(400).json({
        message: "Invalid fine type",
      });
    }

    // Validate amount
    if (amount !== undefined) {
      const fineAmount = Number(amount);

      if (!Number.isFinite(fineAmount) || fineAmount <= 0) {
        return res.status(400).json({
          message: "Fine amount must be greater than zero",
        });
      }

      // Calculate payments already received
      const payments = await FinePayment.find({ fine: id });

      const totalPaid = payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      );

      // Do not reduce the fine below what has already been paid
      if (fineAmount < totalPaid) {
        return res.status(400).json({
          message: `Fine amount cannot be less than the amount already paid (KSh ${totalPaid}).`,
          totalPaid,
        });
      }

      fine.amount = fineAmount;
    }

    if (fineType !== undefined) {
      fine.fineType = fineType;
    }

    if (description !== undefined) {
      if (fineType === "Other" && !description.trim()) {
        return res.status(400).json({
          message: "Description is required for an Other fine",
        });
      }

      fine.description = description.trim();
    }

    // Recalculate status from actual payments
    const payments = await FinePayment.find({ fine: id });

    const totalPaid = payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
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

    const updatedFine = await Fine.findById(id).populate(
      "member",
      "memberNumber fullName phoneNumber",
    );

    return res.status(200).json({
      message: "Fine updated successfully",
      fine: updatedFine,
      totalPaid,
      balance: Math.max(0, fine.amount - totalPaid),
    });
  } catch (error) {
    console.error("Update Fine Error:", error);

    return res.status(500).json({
      message: "Failed to update fine",
      error: error.message,
    });
  }
};

// ==============================
// DELETE FINE
// ==============================
exports.deleteFine = async (req, res) => {
  try {
    const { id } = req.params;

    const fine = await Fine.findById(id);

    if (!fine) {
      return res.status(404).json({
        message: "Fine not found",
      });
    }

    // Check whether fine has payments
    const payments = await FinePayment.find({
      fine: id,
    });

    if (payments.length > 0) {
      return res.status(400).json({
        message: "This fine cannot be deleted because it already has payments",
      });
    }

    await Fine.findByIdAndDelete(id);

    res.status(200).json({
      message: "Fine deleted successfully",
    });
  } catch (error) {
    console.error("Delete Fine Error:", error);

    res.status(500).json({
      message: "Failed to delete fine",
      error: error.message,
    });
  }
};

// ==============================
// Get fines for the logged-in member
// ==============================
exports.getMyFines = async (req, res) => {
  try {
    const fines = await Fine.find({
      member: req.user.id,
    })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ createdAt: -1 });
    const totalFines = fines.reduce((total, fine) => total + fine.amount, 0);

    res.status(200).json({
      message: "Your fines retrieved successfully",
      count: fines.length,
      totalFines,
      fines,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve your fines",
      error: error.message,
    });
  }
};

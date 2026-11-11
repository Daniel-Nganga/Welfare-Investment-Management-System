const SystemConfig = require("../models/systemConfigModel");

// GET SYSTEM CONFIGURATION
exports.getSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne({ configKey: "main" });

    // Create default configuration if it does not exist
    if (!config) {
      config = await SystemConfig.create({
        configKey: "main",
      });
    }

    res.status(200).json({
      success: true,
      message: "System configuration retrieved successfully",
      data: config,
    });
  } catch (error) {
    console.error("Get system configuration error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve system configuration",
    });
  }
};

// UPDATE SYSTEM CONFIGURATION
exports.updateSystemConfig = async (req, res) => {
  try {
    const {
      organizationName,
      organizationEmail,
      organizationPhone,
      financialYear,
      currency,
    } = req.body;

    // Validate organization name
    if (!organizationName || !organizationName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization name is required",
      });
    }

    // Validate email if provided
    if (
      organizationEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizationEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid organization email",
      });
    }

    // Only KES is currently supported
    if (currency !== "KES") {
      return res.status(400).json({
        success: false,
        message: "Unsupported system currency",
      });
    }

    const config = await SystemConfig.findOneAndUpdate(
      { configKey: "main" },
      {
        $set: {
          organizationName: organizationName.trim(),
          organizationEmail: organizationEmail?.trim() || "",
          organizationPhone: organizationPhone?.trim() || "",
          financialYear,
          currency,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      success: true,
      message: "System configuration updated successfully",
      data: config,
    });
  } catch (error) {
    console.error("Update system configuration error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update system configuration",
    });
  }
};

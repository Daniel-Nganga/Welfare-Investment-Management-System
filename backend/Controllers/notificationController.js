const Notification = require("../models/notificationModel");

// CREATE NOTIFICATION
exports.createNotification = async ({
  recipient,
  title,
  message,
  type = "general",
  link = "",
}) => {
  try {
    return await Notification.create({
      recipient,
      title,
      message,
      type,
      link,
    });
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

// GET MEMBER NOTIFICATIONS
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const notifications = await Notification.find({
      recipient: userId,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
};

// MARK ONE NOTIFICATION AS READ
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: userId,
      },
      {
        isRead: true,
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

// MARK ALL NOTIFICATIONS AS READ
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};

// DELETE ONE NOTIFICATION
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

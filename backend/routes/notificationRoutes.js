const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../Controllers/notificationController");

const { protectPayment } = require("../middleware/paymentProtectionMiddleware");
router.get("/", protectPayment, getNotifications);

router.put("/read-all", protectPayment, markAllNotificationsRead);

router.put("/:id/read", protectPayment, markNotificationRead);

router.delete("/:id", protectPayment, deleteNotification);

module.exports = router;

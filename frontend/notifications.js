const NOTIFICATION_API = "http://localhost:5000/api/notifications";

const notificationBell = document.getElementById("notificationBell");
const notificationDropdown = document.getElementById("notificationDropdown");
const notificationCount = document.getElementById("notificationCount");
const notificationList = document.getElementById("notificationList");
const markAllButton = document.getElementById("markAllNotificationsRead");

function notificationHeaders() {
  const token = localStorage.getItem("token");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// API REQUEST
async function notificationRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...notificationHeaders(),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Notification request failed");
  }

  return data;
}

// LOAD NOTIFICATIONS
async function loadNotifications() {
  try {
    const data = await notificationRequest(NOTIFICATION_API);

    notificationCount.textContent = data.unreadCount || 0;

    notificationCount.classList.toggle("hidden", !data.unreadCount);

    displayNotifications(data.notifications || []);
  } catch (error) {
    console.error("Loading notifications:", error);

    notificationList.innerHTML = `
      <p class="empty-notifications">
        Unable to load notifications.
      </p>
    `;
  }
}

// DISPLAY NOTIFICATIONS
function displayNotifications(notifications) {
  notificationList.innerHTML = "";

  if (!notifications.length) {
    notificationList.innerHTML = `
      <p class="empty-notifications">
        You have no notifications.
      </p>
    `;
    return;
  }

  notifications.forEach((notification) => {
    const item = createNotificationElement(notification);
    notificationList.appendChild(item);
  });
}

// CREATE A SINGLE NOTIFICATION ELEMENT
function createNotificationElement(notification) {
  const item = document.createElement("div");

  item.className = `notification-item ${notification.isRead ? "" : "unread"}`;

  const content = document.createElement("div");
  content.className = "notification-content";

  const title = document.createElement("h4");
  title.textContent = notification.title;

  const message = document.createElement("p");
  message.textContent = notification.message;

  const date = document.createElement("small");
  date.textContent = new Date(notification.createdAt).toLocaleString();

  content.append(title, message, date);

  const deleteButton = document.createElement("button");
  deleteButton.className = "notification-delete";
  deleteButton.type = "button";
  deleteButton.title = "Delete notification";
  deleteButton.innerHTML = '<i class="fas fa-trash"></i>';

  deleteButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteNotification(notification._id);
  });

  item.append(content, deleteButton);

  item.addEventListener("click", async () => {
    if (!notification.isRead) {
      await markNotificationRead(notification._id);
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  });

  return item;
}

// MARK ONE AS READ
async function markNotificationRead(id) {
  try {
    await notificationRequest(`${NOTIFICATION_API}/${id}/read`, {
      method: "PUT",
    });

    await loadNotifications();
  } catch (error) {
    console.error(error);
  }
}

// MARK ALL AS READ
async function markAllNotificationsRead() {
  try {
    await notificationRequest(`${NOTIFICATION_API}/read-all`, {
      method: "PUT",
    });

    await loadNotifications();
  } catch (error) {
    console.error(error);
  }
}

// DELETE NOTIFICATION
async function deleteNotification(id) {
  try {
    await notificationRequest(`${NOTIFICATION_API}/${id}`, {
      method: "DELETE",
    });

    await loadNotifications();
  } catch (error) {
    console.error(error);
  }
}

// OPEN/CLOSE NOTIFICATION DROPDOWN
notificationBell?.addEventListener("click", () => {
  notificationDropdown.classList.toggle("hidden");

  if (!notificationDropdown.classList.contains("hidden")) {
    loadNotifications();
  }
});

// MARK ALL BUTTON
markAllButton?.addEventListener("click", markAllNotificationsRead);

// LOAD WHEN PAGE OPENS
document.addEventListener("DOMContentLoaded", loadNotifications);

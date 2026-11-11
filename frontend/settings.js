document.addEventListener("DOMContentLoaded", initializeSettings);

const API_BASE = "http://localhost:5000/api";

const API = {
  member: `${API_BASE}/member`,
  systemConfig: `${API_BASE}/system-config/settings`,
  contributionRules: `${API_BASE}/settings/contribution-rules`,
  notifications: `http://localhost:5000/api/notifications`,
};

let currentUser = null;
let currentRole = "";
let authHeaders = {};
let activeTab = "general";
let selectedProfileImage = null;

// ========================================
// INITIALIZE SETTINGS
// ========================================

async function initializeSettings() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const payload = decodeToken(token);

    const userId = payload.id || payload._id || payload.userId;
    currentRole = String(payload.role || "").toLowerCase();

    if (!userId || !["admin", "member"].includes(currentRole)) {
      throw new Error("Invalid login session. Please log in again.");
    }

    authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    // Load logged-in member
    await loadPersonalInformation(userId);

    // Apply admin/member permissions
    applyRoleVisibility(currentRole);

    // Initialize page functionality
    initTabs();
    setupPasswordForm();
    setupProfilePicture();
    setupSaveSettings();

    // Admin-only settings
    if (currentRole === "admin") {
      await loadSystemConfig();
      await loadContributionRules();
    }
  } catch (error) {
    console.error("Settings initialization error:", error);
    showPageNotification(error.message, "error");
  }
}

// ========================================
// JWT DECODING
// ========================================

function decodeToken(token) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid token");
    }

    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    base64 += "=".repeat((4 - (base64.length % 4)) % 4);

    return JSON.parse(atob(base64));
  } catch {
    throw new Error("Your session is invalid. Please log in again.");
  }
}

// ========================================
// API HELPER
// ========================================

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }

  return result;
}

// ========================================
// PERSONAL INFORMATION
// ========================================

async function loadPersonalInformation(userId) {
  const result = await apiRequest(
    `${API.member}/${encodeURIComponent(userId)}`,
  );

  currentUser = result.user || result.member || result;

  if (!currentUser || typeof currentUser !== "object") {
    throw new Error("Member profile was not found.");
  }

  if (currentUser.role) {
    currentRole = String(currentUser.role).toLowerCase();
  }

  setText("MemberName", currentUser.fullName);
  setText("MemberNumber", currentUser.memberNumber);
  setText("PhoneNumber", currentUser.phoneNumber);
  setText(
    "email",
    currentUser.email || currentUser.emailAddress || "Not provided",
  );

  setText("profileName", currentUser.fullName);
  setText("memberRole", currentRole === "admin" ? "Admin" : "Member");

  const image =
    currentUser.profilePicture || "https://i.pravatar.cc/100?img=12";

  const topbarImage = document.getElementById("topbarProfilePicture");

  if (topbarImage) {
    topbarImage.src = image;
  }

  displayProfileImage(image);
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent =
      value !== undefined && value !== null && value !== ""
        ? value
        : "Not provided";
  }
}

// ========================================
// ROLE VISIBILITY
// ========================================

function applyRoleVisibility(role) {
  const isAdmin = role === "admin";

  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = !isAdmin;
  });

  document.querySelectorAll(".member-only").forEach((element) => {
    element.hidden = role !== "member";
  });
}

// ========================================
// TAB SWITCHING
// ========================================

function initTabs() {
  const tabsContainer = document.getElementById("settingsTabs");

  if (!tabsContainer) return;

  const buttons = tabsContainer.querySelectorAll("button[data-tab]");

  function switchTab(tab) {
    activeTab = tab;

    buttons.forEach((button) => {
      const selected = button.dataset.tab === tab;

      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    document
      .querySelectorAll(".settings-card[data-section]")
      .forEach((section) => {
        section.hidden = section.dataset.section !== tab;
      });

    const saveButton = document.getElementById("saveSettingsBtn");

    if (saveButton) {
      saveButton.hidden = tab === "general";
    }
  }

  tabsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tab]");

    if (!button || button.hidden) return;

    switchTab(button.dataset.tab);
  });

  const firstVisible =
    tabsContainer.querySelector("button.active:not([hidden])") ||
    tabsContainer.querySelector("button:not([hidden])");

  if (firstVisible) {
    switchTab(firstVisible.dataset.tab);
  }
}

// ========================================
// PAGE NOTIFICATION
// ========================================

function showPageNotification(message, type = "success") {
  const notification = document.getElementById("pageNotification");

  if (!notification) {
    console.error(message);
    return;
  }

  notification.textContent = message;
  notification.style.display = "block";
  notification.style.position = "fixed";
  notification.style.top = "25px";
  notification.style.right = "25px";
  notification.style.zIndex = "999999";
  notification.style.padding = "15px 20px";
  notification.style.minWidth = "280px";
  notification.style.borderRadius = "8px";

  if (type === "success") {
    notification.style.background = "#dcfce7";
    notification.style.color = "#166534";
    notification.style.borderLeft = "5px solid #16a34a";
  } else {
    notification.style.background = "#fee2e2";
    notification.style.color = "#991b1b";
    notification.style.borderLeft = "5px solid #dc2626";
  }

  clearTimeout(window.notificationTimer);

  window.notificationTimer = setTimeout(() => {
    notification.style.display = "none";
  }, 4000);
}

// ========================================
// ACCOUNT SECURITY - CHANGE PASSWORD
// ========================================

function setupPasswordForm() {
  const form = document.getElementById("changePasswordForm");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentPassword = document
      .getElementById("CurrentPassword")
      .value.trim();

    const newPassword = document.getElementById("newPassword").value;

    const confirmPassword = document.getElementById("repeatPassword").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showPageNotification("Please fill in all password fields.", "error");
      return;
    }

    if (newPassword.length < 8) {
      showPageNotification(
        "New password must contain at least 8 characters.",
        "error",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showPageNotification("New passwords do not match.", "error");
      return;
    }

    if (currentPassword === newPassword) {
      showPageNotification(
        "New password must be different from current password.",
        "error",
      );
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;

    try {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

      const result = await apiRequest(`${API.member}/update-password`, {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      showPageNotification(result.message || "Password updated successfully.");

      form.reset();
    } catch (error) {
      console.error("Password update error:", error);
      showPageNotification(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  });
}

// ========================================
// PASSWORD SHOW/HIDE
// ========================================

document.querySelectorAll(".toggle-password").forEach((icon) => {
  icon.addEventListener("click", () => {
    const input = document.getElementById(icon.dataset.target);

    if (!input) return;

    const show = input.type === "password";

    input.type = show ? "text" : "password";

    icon.classList.toggle("fa-eye", !show);
    icon.classList.toggle("fa-eye-slash", show);
  });
});

// ========================================
// PROFILE PICTURE
// ========================================

function setupProfilePicture() {
  const picker = document.getElementById("image-picker");
  const changeButton = document.getElementById("change-logo-btn");

  if (!picker || !changeButton) return;

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showPageNotification("Please select a valid image.", "error");
      picker.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showPageNotification("Image must not exceed 5MB.", "error");
      picker.value = "";
      return;
    }

    selectedProfileImage = file;

    const reader = new FileReader();

    reader.onload = (event) => {
      displayProfileImage(event.target.result);
    };

    reader.readAsDataURL(file);
  });

  changeButton.addEventListener("click", async () => {
    if (!selectedProfileImage) {
      picker.click();
      return;
    }

    const formData = new FormData();

    formData.append("profilePicture", selectedProfileImage);

    const originalText = changeButton.innerHTML;

    try {
      changeButton.disabled = true;
      changeButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Uploading...';

      const result = await apiRequest(`${API.member}/profile-picture`, {
        method: "PUT",
        body: formData,
      });

      const imageUrl =
        result.profilePicture ||
        result.user?.profilePicture ||
        result.member?.profilePicture;

      if (!imageUrl) {
        throw new Error("Upload succeeded but no image URL was returned.");
      }

      displayProfileImage(imageUrl);

      const topbarImage = document.getElementById("topbarProfilePicture");

      if (topbarImage) {
        topbarImage.src = imageUrl;
      }

      if (currentUser) {
        currentUser.profilePicture = imageUrl;
      }

      selectedProfileImage = null;
      picker.value = "";

      showPageNotification(
        result.message || "Profile picture updated successfully.",
      );
    } catch (error) {
      console.error("Profile picture upload:", error);
      showPageNotification(error.message, "error");
    } finally {
      changeButton.disabled = false;
      changeButton.innerHTML = originalText;
    }
  });
}

function displayProfileImage(imageUrl) {
  const display = document.getElementById("logo-display");

  if (!display) return;

  display.innerHTML = "";

  const image = document.createElement("img");

  image.src = imageUrl;
  image.alt = "Profile picture";
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "cover";
  image.style.borderRadius = "50%";

  display.appendChild(image);
}

// ========================================
// SYSTEM CONFIGURATION - ADMIN
// ========================================

const configFields = {
  organizationName: document.getElementById("organizationName"),
  organizationEmail: document.getElementById("organizationEmail"),
  organizationPhone: document.getElementById("organizationPhone"),
  financialYear: document.getElementById("financialYear"),
  currency: document.getElementById("currency"),
};

async function loadSystemConfig() {
  try {
    const result = await apiRequest(API.systemConfig);

    const config = result.data || result.config || result;

    Object.entries(configFields).forEach(([key, field]) => {
      if (field && config[key] !== undefined) {
        field.value = config[key];
      }
    });
    const organizationNameDisplay = document.getElementById(
      "organizationNameDisplay",
    );
    organizationNameDisplay.textContent = config.organizationName;
    organizationNameDisplay.style.fontWeight = "bold";
    organizationNameDisplay.style.color = "white";
  } catch (error) {
    console.error("Load system configuration:", error);
    showPageNotification(error.message, "error");
  }
}

async function saveSystemConfig() {
  const data = {};

  for (const [key, field] of Object.entries(configFields)) {
    if (field) {
      data[key] = field.value.trim();
    }
  }

  if (!data.organizationName) {
    showPageNotification("Organization name is required.", "error");
    return;
  }

  if (
    data.organizationEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.organizationEmail)
  ) {
    showPageNotification("Enter a valid organization email.", "error");
    return;
  }

  if (!data.financialYear) {
    showPageNotification("Please enter the financial year.", "error");
    return;
  }

  try {
    const result = await apiRequest(API.systemConfig, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    const config = result.data || result.config || result;

    setText("organizationNameDisplay", config.organizationName);

    showPageNotification(
      result.message || "System configuration saved successfully.",
    );
  } catch (error) {
    console.error("Save system configuration:", error);
    showPageNotification(error.message, "error");
  }
}

// ========================================
// CONTRIBUTION RULES - ADMIN
// ========================================

const contributionFields = {
  investmentAmount: document.getElementById("investmentAmount"),
  welfareAmount: document.getElementById("welfareAmount"),
  defaultFineAmount: document.getElementById("defaultFineAmount"),
  contributionDueDay: document.getElementById("contributionDueDay"),
};

async function loadContributionRules() {
  try {
    const result = await apiRequest(API.contributionRules);

    const rules = result.data || result.rules || result;

    Object.entries(contributionFields).forEach(([key, field]) => {
      if (field && rules[key] !== undefined) {
        field.value = rules[key];
      }
    });
  } catch (error) {
    console.error("Load contribution rules:", error);
    showPageNotification(error.message, "error");
  }
}

async function saveContributionRules() {
  const data = {};

  for (const [key, field] of Object.entries(contributionFields)) {
    if (field) {
      data[key] = Number(field.value);
    }
  }

  if (
    !Number.isFinite(data.investmentAmount) ||
    !Number.isFinite(data.welfareAmount) ||
    !Number.isFinite(data.defaultFineAmount) ||
    data.investmentAmount < 0 ||
    data.welfareAmount < 0 ||
    data.defaultFineAmount < 0
  ) {
    showPageNotification("Enter valid contribution amounts.", "error");
    return;
  }

  if (
    !Number.isInteger(data.contributionDueDay) ||
    data.contributionDueDay < 1 ||
    data.contributionDueDay > 31
  ) {
    showPageNotification("Enter a valid contribution due day.", "error");
    return;
  }

  try {
    const result = await apiRequest(API.contributionRules, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    showPageNotification(
      result.message || "Contribution rules updated successfully.",
    );
  } catch (error) {
    console.error("Save contribution rules:", error);
    showPageNotification(error.message, "error");
  }
}

// ========================================
// NOTIFICATION PREFERENCES
// ========================================

const notificationFields = {
  paymentNotifications: document.getElementById("paymentNotifications"),
  fineNotifications: document.getElementById("fineNotifications"),
  attendanceNotifications: document.getElementById("attendanceNotifications"),
  systemNotifications: document.getElementById("systemNotifications"),
};

async function saveNotificationSettings() {
  const data = {};

  Object.entries(notificationFields).forEach(([key, field]) => {
    if (field) {
      data[key] = field.checked;
    }
  });

  try {
    const result = await apiRequest(API.notifications, {
      method: "PUT",
      body: JSON.stringify(data),
    });

    showPageNotification(
      result.message || "Notification preferences saved successfully.",
    );
  } catch (error) {
    console.error("Save notification settings:", error);
    showPageNotification(error.message, "error");
  }
}

// ========================================
// MAIN SAVE SETTINGS BUTTON
// ========================================

function setupSaveSettings() {
  const saveButton = document.getElementById("saveSettingsBtn");

  if (!saveButton) return;

  saveButton.addEventListener("click", async () => {
    const originalText = saveButton.innerHTML;

    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      if (activeTab === "system" && currentRole === "admin") {
        await saveSystemConfig();
      } else if (activeTab === "contribution" && currentRole === "admin") {
        await saveContributionRules();
      } else if (activeTab === "notification") {
        await saveNotificationSettings();
      } else {
        showPageNotification("There are no settings to save here.", "error");
      }
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
    }
  });
}

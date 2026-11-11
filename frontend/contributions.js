document.addEventListener("DOMContentLoaded", loadContributions);

// Change this if your backend uses a different port.
const API_BASE = "http://localhost:5000/api";

let allPayments = [];
let currentRole = "";
let currentUser = null;

// ========================================
// MAIN FUNCTION
// ========================================
async function loadContributions() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    // Decode token for display purposes.
    // The backend must verify the token securely.
    const payload = decodeToken(token);

    const userId = payload.id || payload._id || payload.userId;
    currentRole = String(payload.role || "").toLowerCase();

    if (!userId || !["admin", "member"].includes(currentRole)) {
      throw new Error(
        "Your login information is incomplete. Please log in again.",
      );
    }

    // Load profile if the endpoint is available.
    try {
      const profileResponse = await fetch(`${API_BASE}/member/${userId}`, {
        headers,
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        currentUser = profileData.user || profileData.member || null;

        if (currentUser?.role) {
          currentRole = String(currentUser.role).toLowerCase();
        }
      }
    } catch (error) {
      console.warn("Profile could not be loaded:", error.message);
    }

    if (!["admin", "member"].includes(currentRole)) {
      throw new Error("Your account role could not be verified.");
    }

    // Update the topbar and hide/show role-specific HTML.
    updateUserProfile(currentUser, currentRole);
    applyRoleVisibility(currentRole);

    // Admins load all payments; members load their own.
    const endpoint =
      currentRole === "admin"
        ? `${API_BASE}/saving/all`
        : `${API_BASE}/saving/member`;

    const response = await fetch(endpoint, { headers });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Could not load contributions (${response.status}): ${message}`,
      );
    }

    const data = await response.json();

    // Support the response formats used by your controllers.
    allPayments = Array.isArray(data.payments)
      ? data.payments
      : Array.isArray(data.memberPayments)
        ? data.memberPayments
        : [];

    allPayments = allPayments.filter(
      (payment) => payment.paymentType === "Investment",
    );
    // Sort newest payments first
    allPayments.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.createdAt || 0);
      const dateB = new Date(b.paymentDate || b.createdAt || 0);

      return dateB - dateA;
    });
    // Extra client-side filtering for the member view.
    // The backend must also filter records securely.
    if (currentRole === "member") {
      allPayments = allPayments.filter((payment) => {
        const memberIdFromPayment =
          typeof payment.member === "object"
            ? payment.member?._id
            : payment.member;

        return String(memberIdFromPayment || "") === String(userId);
      });
    }

    setupFilters();
    renderPayments(allPayments);
    showContributionSummary(allPayments);
    // Display Investment total
    updateInvestmentBalance(allPayments);
  } catch (error) {
    console.error("Contributions loading failed:", error);
    showMessage(error.message || "Failed to load contributions.", "error");
  }
}

// ========================================
// DECODE JWT PAYLOAD
// ========================================
function decodeToken(token) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    base64 += "=".repeat((4 - (base64.length % 4)) % 4);

    return JSON.parse(atob(base64));
  } catch {
    throw new Error("Your session is invalid. Please log in again.");
  }
}

// ========================================
// UPDATE TOPBAR USER DETAILS
// ========================================
function updateUserProfile(user, role) {
  const nameElement = document.getElementById("profileName");
  const roleElement = document.getElementById("memberRole");
  const topbarImage = document.getElementById("topbarProfilePicture");

  if (nameElement) {
    nameElement.textContent = user?.fullName || "Logged-in user";
  }

  if (roleElement) {
    roleElement.textContent = role === user.role ? "Administrator" : "Member";
  }
  if (topbarImage) {
    topbarImage.src = user.profilePicture;
  }
}

function updateInvestmentBalance(payments) {
  const paidElement = document.getElementById("AmountPaidInvestment");

  const balanceElement = document.getElementById("BalanceInvestment");

  const startDate = new Date(2025, 8, 1); // September 2025
  const today = new Date();

  // Count months from September 2025 through the current month.
  const totalMonths =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    today.getMonth() -
    startDate.getMonth() +
    1;

  // Change this if the required monthly investment differs.
  const monthlyInvestment = 1400;

  const totalRequired = totalMonths * monthlyInvestment;

  const totalPaid = payments.reduce((total, payment) => {
    const type = String(payment.paymentType || "").toLowerCase();
    const dateValue = payment.paymentDate || payment.createdAt;
    const date = dateValue ? new Date(dateValue) : null;

    if (
      (type === "investment" || type === "savings") &&
      date &&
      !Number.isNaN(date.getTime()) &&
      date >= startDate &&
      date <= today
    ) {
      return total + Number(payment.amount || 0);
    }

    return total;
  }, 0);

  const amountUnpaid = Math.max(0, totalRequired - totalPaid);

  const formatMoney = (amount) =>
    `KSh ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (paidElement) {
    paidElement.textContent = formatMoney(totalPaid);
  }

  if (balanceElement) {
    balanceElement.textContent = formatMoney(amountUnpaid);
  }
}

// ========================================
// SHOW/HIDE ROLE-SPECIFIC HTML
// ========================================
function applyRoleVisibility(role) {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = role !== "admin";
  });

  document.querySelectorAll(".member-only").forEach((element) => {
    element.hidden = role !== "member";
  });
}

// ========================================
// RENDER CONTRIBUTIONS TABLE
// ========================================

function renderPayments(payments) {
  const tableBody = document.querySelector(".card table tbody");

  if (!tableBody) {
    console.error("Could not find the contributions table.");
    return;
  }

  tableBody.innerHTML = "";

  if (payments.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:20px;">
          No Investment payments found.
        </td>
      </tr>
    `;

    updatePagination(0);
    return;
  }

  payments.forEach((payment, index) => {
    const member = typeof payment.member === "object" ? payment.member : null;

    const memberName =
      member?.fullName ||
      (currentRole === "member" ? currentUser?.fullName : null) ||
      "Member";

    const date = payment.paymentDate || payment.createdAt;
    const formattedDate = date
      ? new Date(date).toLocaleDateString("en-KE")
      : "—";

    const paymentType = payment.paymentType || "Investment";
    const amount = Number(payment.amount || 0);
    const method = payment.paymentMethod || "—";
    const status = payment.status || "Paid";

    const row = document.createElement("tr");

    const cells = [
      index + 1,
      formattedDate,
      memberName,
      paymentType,
      `KSh ${amount.toLocaleString("en-KE")}`,
      method,
      status,
    ];

    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    // Edit and Delete buttons for admins only
    if (currentRole === "admin") {
      const actionsCell = document.createElement("td");
      actionsCell.className = "admin-only";

      // Edit icon
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "action-icon edit-btn";
      editButton.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      editButton.title = "Edit payment";
      editButton.setAttribute("aria-label", "Edit payment");

      editButton.addEventListener("click", () => {
        editPayment(payment._id);
      });

      // Delete icon
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "action-icon delete-btn";
      deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteButton.title = "Delete payment";
      deleteButton.setAttribute("aria-label", "Delete payment");
      deleteButton.style = "color:#420101";

      deleteButton.addEventListener("click", () => {
        deletePayment(payment._id);
      });

      actionsCell.appendChild(editButton);
      actionsCell.appendChild(deleteButton);
      row.appendChild(actionsCell);
    }
    tableBody.appendChild(row);
  });

  updatePagination(payments.length);
}

// ========================================
// SEARCH AND FILTERS
// ========================================
function setupFilters() {
  const content = document.querySelector(".filters");
  if (!content) return;

  const searchInput = content.querySelector('input[type="text"]');
  const selects = content.querySelectorAll("select");
  const filterButton = content.querySelector("button");

  const monthSelect = selects[0];
  const yearSelect = selects[1];

  if (monthSelect) {
    monthSelect.innerHTML = '<option value="">All Months</option>';

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    months.forEach((month, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = month;
      monthSelect.appendChild(option);
    });
  }

  if (yearSelect) {
    const years = [
      ...new Set(
        allPayments
          .map((payment) => {
            const date = payment.paymentDate || payment.createdAt;
            return date ? new Date(date).getFullYear() : null;
          })
          .filter(Boolean),
      ),
    ].sort((a, b) => b - a);

    yearSelect.innerHTML = '<option value="">All Years</option>';

    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    });
  }

  const applyFilters = () => {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const selectedMonth = monthSelect?.value ?? "";
    const selectedYear = yearSelect?.value ?? "";

    const filtered = allPayments.filter((payment) => {
      const member = typeof payment.member === "object" ? payment.member : null;

      const memberName = member?.fullName || currentUser?.fullName || "";

      const memberNumber = member?.memberNumber || "";
      const type = payment.paymentType || "";
      const method = payment.paymentMethod || "";

      const matchesSearch = `${memberName} ${memberNumber} ${type} ${method}`
        .toLowerCase()
        .includes(search);

      const dateValue = payment.paymentDate || payment.createdAt;
      const date = dateValue ? new Date(dateValue) : null;

      const matchesMonth =
        selectedMonth === "" ||
        (date && date.getMonth() === Number(selectedMonth));

      const matchesYear =
        selectedYear === "" ||
        (date && date.getFullYear() === Number(selectedYear));

      return matchesSearch && matchesMonth && matchesYear;
    });

    renderPayments(filtered);
    showContributionSummary(filtered);
  };

  searchInput?.addEventListener("input", applyFilters);
  monthSelect?.addEventListener("change", applyFilters);
  yearSelect?.addEventListener("change", applyFilters);
  filterButton?.addEventListener("click", applyFilters);
}

// ========================================
// CONTRIBUTION TOTAL
// ========================================
function showContributionSummary(payments) {
  const total = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  // Optional summary element: add it to HTML if desired.
  const summary = document.getElementById("contributionTotal");

  if (summary) {
    summary.textContent = `KSh ${total.toLocaleString("en-KE")}`;
  }
}

// ========================================
// PAGINATION LABEL
// ========================================
function updatePagination(count) {
  const label = document.querySelector(".pagination > span");

  if (label) {
    label.textContent = `Showing ${count} contribution record(s)`;
  }
}

// ========================================
// DISPLAY ERRORS
// ========================================
function showMessage(message, type = "info") {
  let box = document.getElementById("contributionsMessage");

  if (!box) {
    box = document.createElement("div");
    box.id = "contributionsMessage";
    box.style.margin = "15px 0";

    const content = document.querySelector(".content");

    if (content) {
      content.prepend(box);
    } else {
      document.body.prepend(box);
    }
  }

  box.textContent = message;
  box.style.color = type === "error" ? "#b91c1c" : "#334155";
}

/* ========================================
   ADD PAYMENT
======================================== */

const CREATE_PAYMENT_URL = `${API_BASE}/saving/add`;

function initializeAddPayment() {
  const modal = document.getElementById("paymentModal");
  const openButton = document.getElementById("addPaymentBtn");
  const closeButton = document.getElementById("closePaymentModal");
  const cancelButton = document.getElementById("cancelPaymentBtn");
  const form = document.getElementById("addPaymentForm");
  const methodSelect = document.getElementById("paymentMethod");
  const codeInput = document.getElementById("confirmationCode");
  const codeGroup = document.getElementById("confirmationCodeGroup");

  if (!modal || !form) return;

  openButton?.addEventListener("click", () => {
    if (currentRole !== "admin") return;

    form.reset();
    showPaymentFormMessage("");
    modal.hidden = false;
  });

  function closeModal() {
    modal.hidden = true;
  }

  closeButton?.addEventListener("click", closeModal);
  cancelButton?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  // Confirmation code is required for Mpesa, optional for Cash.
  function updateConfirmationField() {
    const isMpesa = methodSelect.value === "Mpesa";

    codeInput.required = isMpesa;
    codeInput.placeholder = isMpesa
      ? "Enter Mpesa confirmation code"
      : "Optional for Cash";
    codeGroup.hidden = !isMpesa && methodSelect.value === "Cash";

    if (!isMpesa) codeInput.value = "";
  }

  methodSelect.addEventListener("change", updateConfirmationField);
  updateConfirmationField();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (currentRole !== "admin") {
      showPaymentFormMessage(
        "Only administrators can record payments.",
        "error",
      );
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    const memberNumber = document.getElementById("memberNumber").value.trim();

    const paymentType = document.getElementById("paymentType").value;
    const amount = Number(document.getElementById("amount").value);
    const paymentMethod = methodSelect.value;
    const confirmationCode = codeInput.value.trim();

    if (
      !memberNumber ||
      !paymentType ||
      !paymentMethod ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      showPaymentFormMessage(
        "Please enter valid details in all required fields.",
        "error",
      );
      return;
    }

    if (paymentMethod === "Mpesa" && !confirmationCode) {
      showPaymentFormMessage("Enter the Mpesa confirmation code.", "error");
      return;
    }

    const saveButton = document.getElementById("savePaymentBtn");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const response = await fetch(CREATE_PAYMENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberNumber,
          paymentType,
          amount,
          paymentMethod,
          confirmationCode: confirmationCode || undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || result.error);
      }

      showPaymentFormMessage(
        result.message || "Payment recorded successfully.",
        "success",
      );

      form.reset();
      updateConfirmationField();

      // Reload the table and totals using your existing function.
      if (typeof loadContributions === "function") {
        await loadContributions();
      }

      setTimeout(() => {
        modal.hidden = true;
      }, 800);
    } catch (error) {
      console.error("Payment creation failed:", error);
      showPaymentFormMessage(error.message, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Payment";
    }
  });
}

function showPaymentFormMessage(message, type = "") {
  const element = document.getElementById("paymentFormMessage");

  if (!element) return;

  element.textContent = message;
  element.className = type;
}

/* ========================================
   DELETE PAYMENT
======================================== */

let paymentToDelete = null;

const deleteModal = document.getElementById("deletePaymentModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const pageNotification = document.getElementById("pageNotification");

function showNotification(message, isError = false) {
  pageNotification.textContent = message;
  pageNotification.classList.toggle("error", isError);
  pageNotification.classList.add("show");

  // Automatically hide after 4 seconds
  setTimeout(() => {
    pageNotification.classList.remove("show");
  }, 4000);
}

// Open confirmation modal
function deletePayment(paymentId) {
  if (currentRole !== "admin") {
    showNotification("Only admins can delete payments.", true);
    return;
  }

  paymentToDelete = paymentId;
  deleteModal.classList.add("show");
}

// Cancel deletion
cancelDeleteBtn.addEventListener("click", () => {
  paymentToDelete = null;
  deleteModal.classList.remove("show");
});

// Click outside the modal to cancel
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    paymentToDelete = null;
    deleteModal.classList.remove("show");
  }
});

// Confirm deletion
confirmDeleteBtn.addEventListener("click", async () => {
  if (!paymentToDelete) return;

  const paymentId = paymentToDelete;
  const token = localStorage.getItem("token");

  confirmDeleteBtn.disabled = true;
  cancelDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    const response = await fetch(`${API_BASE}/saving/${paymentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete payment.");
    }

    deleteModal.classList.remove("show");
    paymentToDelete = null;

    showNotification("Payment deleted successfully.");

    await loadContributions();
  } catch (error) {
    console.error("Delete payment error:", error);
    showNotification(error.message || "Unable to delete payment.", true);
  } finally {
    confirmDeleteBtn.disabled = false;
    cancelDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete Payment";
  }
});

/* ========================================
   edit PAYMENT
======================================== */

let editingPaymentId = null;

function editPayment(paymentId) {
  if (currentRole !== "admin") {
    showNotification("Only admins can edit payments.", true);
    return;
  }

  const payment = allPayments.find((p) => String(p._id) === String(paymentId));

  if (!payment) {
    showNotification("Payment not found. Please reload the page.", true);
    return;
  }

  // Store the payment ID
  editingPaymentId = payment._id;

  // Fill the form with existing payment details
  // Display the member number
  document.getElementById("memberNumber").value =
    payment.memberNumber || payment.member?.memberNumber || "";
  document.getElementById("paymentType").value =
    payment.paymentType || "Investment";

  document.getElementById("amount").value = payment.amount ?? "";

  document.getElementById("paymentMethod").value =
    payment.paymentMethod || "Cash";

  document.getElementById("confirmationCode").value =
    payment.confirmationCode || "";

  // Update modal heading and button
  document.getElementById("paymentModalTitle").textContent =
    "Edit Investment Payment";

  document.getElementById("savePaymentBtn").textContent = "Update Payment";

  // Open the existing payment modal
  document.getElementById("paymentModal").hidden = false;
}
function showNotification(message, isError = false) {
  const notification = document.getElementById("pageNotification");

  notification.textContent = message;
  notification.classList.toggle("error", isError);
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 4000);
}

document.getElementById("addPaymentBtn")?.addEventListener("click", () => {
  editingPaymentId = null;

  document.getElementById("addPaymentForm").reset();

  document.getElementById("paymentModalTitle").textContent = "Add Payment";

  document.getElementById("savePaymentBtn").textContent = "Save Payment";

  document.getElementById("paymentModal").hidden = false;
});
// Initialize after the page has loaded.
document.addEventListener("DOMContentLoaded", initializeAddPayment);

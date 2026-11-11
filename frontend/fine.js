// ============================================================
// fine.js  –  Fines & Fine Payments page
//   • Admin  : sees every fine and every fine payment, can add / edit / delete
//   • Member : sees only their own fines and payments (read-only)
// ============================================================

// Change this if your backend uses a different port.
const API_BASE = "http://localhost:5000/api";
const PAGE_SIZE = 10;

// ---------- State ----------
let currentRole = "";
let currentUser = null;

let allFines = []; // fines + computed totals (amountPaid, pendingAmount, status)
let allFinePayments = []; // payments + resolved fine / member

let editingFineId = null;
let editingFinePaymentId = null;
let pendingDelete = null; // { type: "fine" | "payment", id }

const pageState = { fines: 1, payments: 1 };

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);

const formatMoney = (amount) =>
  `KSh ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Works whether a reference is a populated object or a plain id string.
const getId = (value) =>
  value && typeof value === "object"
    ? String(value._id || value.id || "")
    : String(value || "");

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-KE") : "—";

const isAdmin = () => currentRole === "admin";

// ---------- Element references ----------
const fineForm = $("addPaymentForm");
const fineActionSelect = $("fineAction");
const memberNumberInput = $("memberNumber");
const fineIdSelect = $("fineId");
const fineTypeSelect = $("fineType");
const fineDescription = $("fineDescription");
const amountInput = $("amount");
const paymentStatusInput = $("paymentStatus");
const paymentMethodSelect = $("paymentMethod");
const confirmationCodeInput = $("confirmationCode");
const fineMessage = $("paymentFormMessage");
const savePaymentBtn = $("savePaymentBtn");
const paymentModal = $("paymentModal");

const fineSelectionGroup = $("fineSelectionGroup");
const fineTypeGroup = $("fineTypeGroup");
const descriptionGroup = $("otherFineDescriptionGroup");
const paymentStatusGroup = $("paymentStatusGroup");
const paymentMethodGroup = $("paymentMethodGroup");
const confirmationCodeGroup = $("confirmationCodeGroup");

const deleteModal = $("deletePaymentModal");
const cancelDeleteBtn = $("cancelDeleteBtn");
const confirmDeleteBtn = $("confirmDeleteBtn");

// ============================================================
// API HELPERS
// ============================================================
async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "index.html";
    throw new Error("Please log in again.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
    throw new Error("Your session has expired. Please log in again.");
  }

  return response;
}

async function sendJson(method, url, body) {
  const response = await authFetch(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`,
    );
  }

  return data;
}

// ============================================================
// DECODE JWT PAYLOAD
// ============================================================
function decodeToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");

    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    base64 += "=".repeat((4 - (base64.length % 4)) % 4);

    return JSON.parse(atob(base64));
  } catch {
    throw new Error("Your session is invalid. Please log in again.");
  }
}

// ============================================================
// TOPBAR + ROLE VISIBILITY
// ============================================================
function updateUserProfile(user, role) {
  const nameElement = $("profileName");
  const roleElement = $("memberRole");

  if (nameElement) nameElement.textContent = user?.fullName || "Logged-in user";
  if (roleElement) {
    roleElement.textContent = role === "admin" ? "Administrator" : "Member";
  }
}

function applyRoleVisibility(role) {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = role !== "admin";
  });

  document.querySelectorAll(".member-only").forEach((element) => {
    element.hidden = role !== "member";
  });
}

// ============================================================
// LOAD DATA  (admin → everything, member → own records only)
// ============================================================
async function loadFinesData() {
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
      throw new Error("Invalid login. Please log in again.");
    }

    // Logged-in user's profile (used for name and role).
    try {
      const profileResponse = await authFetch(`${API_BASE}/member/${userId}`);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        currentUser = profileData.user || profileData.member || null;

        if (currentUser?.role) {
          currentRole = String(currentUser.role).toLowerCase();
        }
      }
    } catch (error) {
      console.warn("Profile loading failed:", error.message);
    }

    updateUserProfile(currentUser, currentRole);
    applyRoleVisibility(currentRole);

    const myId = String(currentUser?._id || currentUser?.id || userId);

    const finesEndpoint = isAdmin()
      ? `${API_BASE}/fines/all`
      : `${API_BASE}/fines/member/${myId}`;

    const paymentsEndpoint = isAdmin()
      ? `${API_BASE}/fine-payments/all`
      : `${API_BASE}/fine-payments/member/${myId}`;

    const [finesResponse, paymentsResponse] = await Promise.all([
      authFetch(finesEndpoint),
      authFetch(paymentsEndpoint),
    ]);

    if (!finesResponse.ok || !paymentsResponse.ok) {
      throw new Error("Failed to fetch fines or fine payments.");
    }

    const [finesData, paymentsData] = await Promise.all([
      finesResponse.json(),
      paymentsResponse.json(),
    ]);

    let fines = Array.isArray(finesData)
      ? finesData
      : finesData.fines || finesData.memberFines || finesData.data || [];

    let payments = Array.isArray(paymentsData)
      ? paymentsData
      : paymentsData.payments ||
        paymentsData.finePayments ||
        paymentsData.data ||
        [];

    // Safety net: even if the backend returned too much, a member only
    // ever sees their own records. (The backend must enforce this too.)
    if (!isAdmin()) {
      fines = fines.filter((fine) => {
        const id = getId(fine.member);
        return !id || id === myId;
      });

      const visibleFineIds = new Set(fines.map((fine) => getId(fine._id)));

      payments = payments.filter((payment) => {
        const id = getId(payment.member);
        return id ? id === myId : visibleFineIds.has(getId(payment.fine));
      });
    }

    buildRecords(fines, payments);
    populateYearFilter();
    applyFilters();
  } catch (error) {
    console.error("Fine records loading failed:", error);
    showNotification(error.message || "Failed to load fine records.", true);
  }
}

// Combine fines with their payments and compute balances.
function buildRecords(fines, payments) {
  const memberOf = (ref, fallback) => {
    if (ref && typeof ref === "object") return ref;
    if (!isAdmin()) return currentUser || {};
    return fallback || {};
  };

  allFines = fines.map((fine) => {
    const fineId = getId(fine._id || fine.id);

    const related = payments.filter(
      (payment) => getId(payment.fine) === fineId,
    );

    const amountPaid = related.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    const fineAmount = Number(fine.amount || 0);
    const pendingAmount = Math.max(0, fineAmount - amountPaid);

    return {
      ...fine,
      _id: fineId,
      memberInfo: memberOf(fine.member),
      fineAmount,
      amountPaid,
      pendingAmount,
      status:
        pendingAmount <= 0
          ? "Paid"
          : amountPaid > 0
            ? "Partially Paid"
            : "Pending",
    };
  });

  const finesById = new Map(allFines.map((fine) => [fine._id, fine]));

  allFinePayments = payments.map((payment) => {
    const fine =
      finesById.get(getId(payment.fine)) ||
      (payment.fine && typeof payment.fine === "object" ? payment.fine : null);

    return {
      ...payment,
      _id: getId(payment._id || payment.id),
      linkedFineId: getId(payment.fine),
      fineType: fine?.fineType || "—",
      fineDescription: fine?.description || "",
      memberInfo: memberOf(payment.member, fine?.memberInfo || fine?.member),
    };
  });
}

// ============================================================
// FILTERS
// ============================================================
function populateYearFilter() {
  const select = $("fineYearFilter");
  if (!select) return;

  const current = select.value;
  const years = new Set([new Date().getFullYear()]);

  allFines.forEach((fine) => {
    const date = fine.date || fine.createdAt;
    if (date) years.add(new Date(date).getFullYear());
  });

  allFinePayments.forEach((payment) => {
    const date = payment.paymentDate || payment.createdAt;
    if (date) years.add(new Date(date).getFullYear());
  });

  select.innerHTML = '<option value="">All Years</option>';

  [...years]
    .sort((a, b) => b - a)
    .forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      select.appendChild(option);
    });

  select.value = current;
}

function matchesFilters(filters, text, dateValue) {
  if (filters.search && !text.toLowerCase().includes(filters.search)) {
    return false;
  }

  if (filters.month === "" && filters.year === "") return true;

  const date = dateValue ? new Date(dateValue) : null;
  if (!date) return false;

  if (filters.month !== "" && date.getMonth() !== Number(filters.month)) {
    return false;
  }

  if (filters.year !== "" && date.getFullYear() !== Number(filters.year)) {
    return false;
  }

  return true;
}

function applyFilters(resetPages = false) {
  if (resetPages) {
    pageState.fines = 1;
    pageState.payments = 1;
  }

  const filters = {
    search: ($("fineSearchInput")?.value || "").trim().toLowerCase(),
    month: $("fineMonthFilter")?.value ?? "",
    year: $("fineYearFilter")?.value ?? "",
  };

  const fines = allFines.filter((fine) =>
    matchesFilters(
      filters,
      [
        fine.memberInfo?.fullName,
        fine.memberInfo?.memberNumber,
        fine.fineType,
        fine.description,
        fine.status,
      ].join(" "),
      fine.date || fine.createdAt,
    ),
  );

  const payments = allFinePayments.filter((payment) =>
    matchesFilters(
      filters,
      [
        payment.memberInfo?.fullName,
        payment.memberInfo?.memberNumber,
        payment.fineType,
        payment.paymentMethod,
        payment.confirmationCode,
      ].join(" "),
      payment.paymentDate || payment.createdAt,
    ),
  );

  renderSummary(fines, payments);
  renderFinesTable(fines);
  renderPaymentsTable(payments);

  $("fineCount").textContent = String(fines.length);
  $("finePaymentCount").textContent = String(payments.length);
}

// ============================================================
// SUMMARY CARDS
// ============================================================
function renderSummary(fines, payments) {
  const totalFines = fines.reduce((sum, fine) => sum + fine.fineAmount, 0);
  const totalPending = fines.reduce((sum, fine) => sum + fine.pendingAmount, 0);
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  $("totalFinesAmount").textContent = formatMoney(totalFines);
  $("AmountPaidFine").textContent = formatMoney(totalPaid);
  $("BalanceWelFine").textContent = formatMoney(totalPending);
}

// ============================================================
// TABLE RENDERING
// ============================================================
function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function memberCell(member) {
  const td = document.createElement("td");
  td.textContent = member?.fullName || "Member";

  if (member?.memberNumber) {
    const small = document.createElement("small");
    small.textContent = `#${member.memberNumber}`;
    small.style.display = "block";
    small.style.opacity = "0.7";
    td.appendChild(small);
  }

  return td;
}

function fineTypeCell(type, description) {
  const td = document.createElement("td");
  td.textContent = type || "Other";

  if (description) {
    const small = document.createElement("small");
    small.textContent = description;
    small.style.display = "block";
    small.style.opacity = "0.7";
    td.appendChild(small);
  }

  return td;
}

function statusCell(status) {
  const td = cell(status);
  td.style.fontWeight = "bold";
  td.style.color =
    status === "Paid"
      ? "#15803d"
      : status === "Partially Paid"
        ? "#b45309"
        : "#b91c1c";
  return td;
}

function actionButton(iconClass, title, onClick, color) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-icon";
  button.innerHTML = `<i class="${iconClass}"></i>`;
  button.title = title;
  button.setAttribute("aria-label", title);
  if (color) button.style.color = color;
  button.addEventListener("click", onClick);
  return button;
}

function actionsCell(onEdit, onDelete, label) {
  const td = document.createElement("td");
  td.appendChild(
    actionButton("fa-solid fa-pen-to-square", `Edit ${label}`, onEdit),
  );
  td.appendChild(
    actionButton("fa-solid fa-trash", `Delete ${label}`, onDelete, "#420101"),
  );
  return td;
}

function renderEmpty(body, colspan, message) {
  body.innerHTML = "";
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colspan;
  td.className = "empty-state";
  td.style.textAlign = "center";
  td.style.padding = "20px";
  td.textContent = message;
  row.appendChild(td);
  body.appendChild(row);
}

function paginate(rows, key) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  pageState[key] = Math.min(Math.max(1, pageState[key]), pages);
  const start = (pageState[key] - 1) * PAGE_SIZE;
  return { start, slice: rows.slice(start, start + PAGE_SIZE) };
}

function renderFinesTable(fines) {
  const body = $("finesTableBody");
  const colspan = isAdmin() ? 9 : 8;

  if (!fines.length) {
    renderEmpty(body, colspan, "No fine records found.");
    $("finesRecordCount").textContent = "Showing 0 fine records";
    $("finesPagination").innerHTML = "";
    return;
  }

  const { start, slice } = paginate(fines, "fines");
  body.innerHTML = "";

  slice.forEach((fine, index) => {
    const row = document.createElement("tr");

    row.appendChild(cell(start + index + 1));
    row.appendChild(cell(formatDate(fine.date || fine.createdAt)));
    row.appendChild(memberCell(fine.memberInfo));
    row.appendChild(fineTypeCell(fine.fineType, fine.description));
    row.appendChild(cell(formatMoney(fine.fineAmount)));
    row.appendChild(cell(formatMoney(fine.amountPaid)));
    row.appendChild(cell(formatMoney(fine.pendingAmount)));
    row.appendChild(statusCell(fine.status));

    if (isAdmin()) {
      row.appendChild(
        actionsCell(
          () => editFine(fine._id),
          () => openDeleteModal("fine", fine._id),
          "fine",
        ),
      );
    }

    body.appendChild(row);
  });

  $("finesRecordCount").textContent =
    `Showing ${start + 1}–${start + slice.length} of ${fines.length} fine record(s)`;

  renderPagination("finesPagination", fines.length, "fines");
}

function renderPaymentsTable(payments) {
  const body = $("finePaymentHistoryBody");
  const colspan = isAdmin() ? 8 : 7;

  if (!payments.length) {
    renderEmpty(body, colspan, "No fine payment records found.");
    $("paymentsRecordCount").textContent = "Showing 0 payment records";
    $("paymentsPagination").innerHTML = "";
    return;
  }

  const { start, slice } = paginate(payments, "payments");
  body.innerHTML = "";

  slice.forEach((payment, index) => {
    const row = document.createElement("tr");

    row.appendChild(cell(start + index + 1));
    row.appendChild(cell(formatDate(payment.paymentDate || payment.createdAt)));
    row.appendChild(memberCell(payment.memberInfo));
    row.appendChild(fineTypeCell(payment.fineType, payment.fineDescription));
    row.appendChild(cell(formatMoney(payment.amount)));
    row.appendChild(cell(payment.paymentMethod || "—"));
    row.appendChild(cell(payment.confirmationCode || "—"));

    if (isAdmin()) {
      row.appendChild(
        actionsCell(
          () => editFinePayment(payment._id),
          () => openDeleteModal("payment", payment._id),
          "payment",
        ),
      );
    }

    body.appendChild(row);
  });

  $("paymentsRecordCount").textContent =
    `Showing ${start + 1}–${start + slice.length} of ${payments.length} payment record(s)`;

  renderPagination("paymentsPagination", payments.length, "payments");
}

function renderPagination(containerId, total, key) {
  const container = $(containerId);
  container.innerHTML = "";

  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return;

  const current = pageState[key];

  const addButton = (
    label,
    page,
    { disabled = false, active = false } = {},
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-btn${active ? " active" : ""}`;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => {
      pageState[key] = page;
      applyFilters();
    });
    container.appendChild(button);
  };

  addButton("‹", current - 1, { disabled: current === 1 });

  let first = Math.max(1, current - 2);
  const last = Math.min(pages, first + 4);
  first = Math.max(1, last - 4);

  for (let page = first; page <= last; page++) {
    addButton(String(page), page, { active: page === current });
  }

  addButton("›", current + 1, { disabled: current === pages });
}

// ============================================================
// MODAL FORM  (record fine / pay fine / edit fine / edit payment)
// ============================================================
function updateFineForm() {
  const isPaying = fineActionSelect.value === "pay";
  const editingFine = Boolean(editingFineId);
  const editingPayment = Boolean(editingFinePaymentId);
  const isMpesa = paymentMethodSelect.value === "Mpesa";
  const isOther = !isPaying && fineTypeSelect.value === "Other";

  // Action can't be switched while editing an existing record.
  fineActionSelect.disabled = editingFine || editingPayment;

  fineSelectionGroup.hidden = !isPaying;
  fineTypeGroup.hidden = isPaying;
  descriptionGroup.hidden = !isOther;

  // Payment status is calculated by the system – never editable.
  paymentStatusGroup.hidden = isPaying || editingFine;
  paymentStatusInput.disabled = true;

  paymentMethodGroup.hidden = !isPaying;
  confirmationCodeGroup.hidden = !(isPaying && isMpesa);

  paymentMethodSelect.required = isPaying;
  confirmationCodeInput.required = isPaying && isMpesa;
  fineIdSelect.required = isPaying;
  fineTypeSelect.required = !isPaying;
  fineDescription.required = isOther;
  memberNumberInput.required = true;
  amountInput.required = true;

  if (!isOther) fineDescription.value = "";
  if (!isMpesa) confirmationCodeInput.value = "";

  let title = "Record Fine";
  let button = "Record Fine";

  if (editingFine) {
    title = "Edit Fine Details";
    button = "Update Fine";
  } else if (editingPayment) {
    title = "Edit Fine Payment";
    button = "Update Payment";
  } else if (isPaying) {
    title = "Record Fine Payment";
    button = "Record Fine Payment";
  }

  $("paymentModalTitle").textContent = title;
  savePaymentBtn.textContent = button;
}

function resetFineSelect() {
  fineIdSelect.innerHTML = '<option value="">Select a fine</option>';
  fineIdSelect.disabled = false;
}

function closeAndResetFineModal() {
  editingFineId = null;
  editingFinePaymentId = null;

  fineForm.reset();
  resetFineSelect();

  memberNumberInput.readOnly = false;
  fineActionSelect.disabled = false;
  savePaymentBtn.disabled = false;

  fineMessage.textContent = "";
  fineMessage.style.color = "";

  paymentModal.hidden = true;
  updateFineForm();
}

function openFineModal(mode = "record") {
  closeAndResetFineModal();
  fineActionSelect.value = mode;
  updateFineForm();
  paymentModal.hidden = false;
}

// Outstanding fines for the typed member number (from already-loaded data).
function loadMemberFines(memberNumber) {
  resetFineSelect();

  if (!memberNumber) return;

  const outstanding = allFines.filter(
    (fine) =>
      String(fine.memberInfo?.memberNumber ?? "") === memberNumber &&
      fine.pendingAmount > 0,
  );

  if (!outstanding.length) {
    fineIdSelect.innerHTML =
      '<option value="">No outstanding fines found</option>';
    return;
  }

  outstanding.forEach((fine) => {
    const option = document.createElement("option");
    option.value = fine._id;
    option.textContent =
      `${fine.fineType}${fine.description ? " - " + fine.description : ""} ` +
      `(Balance ${formatMoney(fine.pendingAmount)} of ${formatMoney(fine.fineAmount)})`;
    fineIdSelect.appendChild(option);
  });
}

function editFine(fineId) {
  if (!isAdmin()) {
    showNotification("Only administrators can edit fines.", true);
    return;
  }

  const fine = allFines.find((item) => item._id === String(fineId));

  if (!fine) {
    showNotification("Fine record not found.", true);
    return;
  }

  closeAndResetFineModal();

  editingFineId = fine._id;

  fineActionSelect.value = "record";
  memberNumberInput.value = fine.memberInfo?.memberNumber || "";
  memberNumberInput.readOnly = true;

  fineTypeSelect.value = fine.fineType || "";
  fineDescription.value = fine.description || "";
  amountInput.value = fine.fineAmount ?? "";
  paymentStatusInput.value = fine.status || "Pending";

  updateFineForm();

  // updateFineForm clears the description when type isn't "Other".
  if (fine.fineType === "Other") fineDescription.value = fine.description || "";

  paymentModal.hidden = false;
}

function editFinePayment(paymentId) {
  if (!isAdmin()) {
    showNotification("Only administrators can edit payments.", true);
    return;
  }

  const payment = allFinePayments.find(
    (item) => item._id === String(paymentId),
  );

  if (!payment) {
    showNotification("Fine payment not found.", true);
    return;
  }

  closeAndResetFineModal();

  editingFinePaymentId = payment._id;

  fineActionSelect.value = "pay";
  memberNumberInput.value = payment.memberInfo?.memberNumber || "";
  memberNumberInput.readOnly = true;

  // Keep the original fine selected; it can't be changed.
  fineIdSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = payment.linkedFineId;
  option.textContent = `${payment.fineType} (original fine)`;
  fineIdSelect.appendChild(option);
  fineIdSelect.value = payment.linkedFineId;
  fineIdSelect.disabled = true;

  amountInput.value = payment.amount ?? "";
  paymentMethodSelect.value = payment.paymentMethod || "";
  confirmationCodeInput.value = payment.confirmationCode || "";

  updateFineForm();

  // updateFineForm clears the code for non-M-Pesa; restore for M-Pesa.
  if (payment.paymentMethod === "Mpesa") {
    confirmationCodeInput.value = payment.confirmationCode || "";
  }

  paymentModal.hidden = false;
}

// ---------- Submit ----------
async function handleFineSubmit(event) {
  event.preventDefault();

  if (!isAdmin()) {
    fineMessage.textContent = "Only administrators can manage fines.";
    return;
  }

  const memberNumber = memberNumberInput.value.trim();
  const amount = Number(amountInput.value);
  const paymentMethod = paymentMethodSelect.value;
  const confirmationCode = confirmationCodeInput.value.trim();

  fineMessage.style.color = "";

  if (!Number.isFinite(amount) || amount <= 0) {
    fineMessage.style.color = "red";
    fineMessage.textContent = "Enter an amount greater than zero.";
    return;
  }

  savePaymentBtn.disabled = true;
  fineMessage.textContent = "Saving...";

  try {
    // 1. Edit an existing fine
    if (editingFineId) {
      const fineType = fineTypeSelect.value;
      const description = fineDescription.value.trim();

      if (!fineType) throw new Error("Please select a fine type.");
      if (fineType === "Other" && !description) {
        throw new Error("Please enter a fine description.");
      }

      await sendJson("PUT", `${API_BASE}/fines/${editingFineId}`, {
        fineType,
        description,
        amount,
      });

      finishFineSuccess("Fine updated successfully.");
      await loadFinesData();
      return;
    }

    // 2. Edit an existing fine payment
    if (editingFinePaymentId) {
      if (!paymentMethod) throw new Error("Select a payment method.");
      if (paymentMethod === "Mpesa" && !confirmationCode) {
        throw new Error("Enter the M-Pesa confirmation code.");
      }

      await sendJson(
        "PUT",
        `${API_BASE}/fine-payments/${editingFinePaymentId}`,
        { amount, paymentMethod, confirmationCode },
      );

      finishFineSuccess("Fine payment updated successfully.");
      await loadFinesData();
      return;
    }

    // 3. Record a payment against a fine
    if (fineActionSelect.value === "pay") {
      const fineId = fineIdSelect.value;

      if (!fineId) throw new Error("Please select a fine to pay.");
      if (!memberNumber || !paymentMethod) {
        throw new Error("Member number and payment method are required.");
      }
      if (paymentMethod === "Mpesa" && !confirmationCode) {
        throw new Error("Enter the M-Pesa confirmation code.");
      }

      const fine = allFines.find((item) => item._id === fineId);
      if (fine && amount > fine.pendingAmount) {
        throw new Error(
          `Amount exceeds the outstanding balance of ${formatMoney(fine.pendingAmount)}.`,
        );
      }

      const result = await sendJson("POST", `${API_BASE}/fine-payments/pay`, {
        fineId,
        memberNumber,
        amount,
        paymentMethod,
        confirmationCode,
      });

      finishFineSuccess(
        result.message || "Fine payment recorded successfully.",
      );
      await loadFinesData();
      return;
    }

    // 4. Record a new fine
    const fineType = fineTypeSelect.value;
    const description = fineDescription.value.trim();

    if (!memberNumber || !fineType) {
      throw new Error("Member number and fine type are required.");
    }
    if (fineType === "Other" && !description) {
      throw new Error("Please enter a description for the fine.");
    }

    const result = await sendJson("POST", `${API_BASE}/fines/add`, {
      memberNumber,
      fineType,
      amount,
      description,
    });

    finishFineSuccess(result.message || "Fine recorded successfully.");
    await loadFinesData();
  } catch (error) {
    console.error("Fine form error:", error);
    fineMessage.style.color = "red";
    fineMessage.textContent =
      error.message || "Failed to save the fine or payment.";
  } finally {
    savePaymentBtn.disabled = false;
  }
}

function finishFineSuccess(message) {
  closeAndResetFineModal();
  showNotification(message);
}

// ============================================================
// DELETE (fines and fine payments)
// ============================================================
function openDeleteModal(type, id) {
  if (!isAdmin()) {
    showNotification("Only administrators can delete records.", true);
    return;
  }

  pendingDelete = { type, id };

  $("deleteModalTitle").textContent =
    type === "fine" ? "Delete Fine?" : "Delete Payment?";
  $("deleteModalMessage").textContent =
    type === "fine"
      ? "Are you sure you want to delete this fine? This action cannot be undone."
      : "Are you sure you want to delete this payment? This action cannot be undone.";

  deleteModal.hidden = false;
  deleteModal.classList.add("show");
}

function closeDeleteModal() {
  pendingDelete = null;
  deleteModal.classList.remove("show");
  deleteModal.hidden = true;
}

async function confirmDelete() {
  if (!pendingDelete) return;

  const { type, id } = pendingDelete;
  const url =
    type === "fine"
      ? `${API_BASE}/fines/delete/${id}`
      : `${API_BASE}/fine-payments/delete/${id}`;

  confirmDeleteBtn.disabled = true;
  cancelDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    await sendJson("DELETE", url);

    closeDeleteModal();
    showNotification(
      type === "fine"
        ? "Fine deleted successfully."
        : "Payment deleted successfully.",
    );

    await loadFinesData();
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(error.message || "Unable to delete record.", true);
  } finally {
    confirmDeleteBtn.disabled = false;
    cancelDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete";
  }
}

// ============================================================
// NOTIFICATION
// ============================================================
let notificationTimer = null;

function showNotification(message, isError = false) {
  const notification = $("pageNotification");
  if (!notification) return;

  notification.textContent = message;
  notification.className = `page-notification show ${isError ? "error" : "success"}`;

  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    notification.className = "page-notification";
    notification.textContent = "";
  }, 4000);
}

// ============================================================
// EVENT WIRING
// ============================================================
function initFinesPage() {
  // Filters
  let searchTimer = null;
  $("fineSearchInput").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFilters(true), 200);
  });
  $("fineMonthFilter").addEventListener("change", () => applyFilters(true));
  $("fineYearFilter").addEventListener("change", () => applyFilters(true));
  $("fineFilterBtn").addEventListener("click", () => applyFilters(true));
  $("fineResetBtn").addEventListener("click", () => {
    $("fineSearchInput").value = "";
    $("fineMonthFilter").value = "";
    $("fineYearFilter").value = "";
    applyFilters(true);
  });

  // Main action button – depends on which tab is open.
  $("addPaymentBtn")?.addEventListener("click", () => {
    const onPaymentsTab = $("paymentsTab").classList.contains("active");
    openFineModal(onPaymentsTab ? "pay" : "record");
  });

  // Form
  fineForm.addEventListener("submit", handleFineSubmit);

  fineActionSelect.addEventListener("change", () => {
    if (!editingFineId && !editingFinePaymentId) {
      fineTypeSelect.value = "";
      fineDescription.value = "";
      amountInput.value = "";
      paymentMethodSelect.value = "";
      confirmationCodeInput.value = "";
      resetFineSelect();
    }

    fineMessage.textContent = "";
    updateFineForm();

    if (fineActionSelect.value === "pay") {
      loadMemberFines(memberNumberInput.value.trim());
    }
  });

  memberNumberInput.addEventListener("change", () => {
    if (fineActionSelect.value === "pay" && !editingFinePaymentId) {
      loadMemberFines(memberNumberInput.value.trim());
    }
  });

  fineIdSelect.addEventListener("change", () => {
    if (editingFinePaymentId) return;

    const fine = allFines.find((item) => item._id === fineIdSelect.value);
    if (fine) amountInput.value = fine.pendingAmount;
  });

  fineTypeSelect.addEventListener("change", updateFineForm);
  paymentMethodSelect.addEventListener("change", updateFineForm);

  $("cancelPaymentBtn").addEventListener("click", closeAndResetFineModal);
  $("closePaymentModal").addEventListener("click", closeAndResetFineModal);

  // Delete modal
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  confirmDeleteBtn.addEventListener("click", confirmDelete);
  deleteModal.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });

  updateFineForm();
}

document.addEventListener("DOMContentLoaded", () => {
  initFinesPage();
  loadFinesData();
});

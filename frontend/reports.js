const API_BASE = "http://localhost:5000/api/reports";
const MEMBERS_API = "http://localhost:5000/api/member/all";
const SETTINGS_API = "http://localhost:5000/api/settings";

const REPORT_CONFIG = {
  "Monthly Report": {
    endpoint: "/financial-summary",
    pdfEndpoint: "/combinepdf",
    useMonth: true,
  },

  "Annual Report": {
    endpoint: "/financial-summary",
    pdfEndpoint: "/combinepdf",
    useMonth: false,
  },

  "Member Statement": {
    endpoint: "/member-statement",
    requiresMember: true,
  },

  "Investment Report": {
    endpoint: "/payments",
    query: { type: "Investment" },
    pdfEndpoint: "/monthly-investment-welfare-contribution/pdf",
    useMonth: true,
  },

  "Welfare Report": {
    endpoint: "/payments",
    query: { type: "Welfare" },
    pdfEndpoint: "/monthly-investment-welfare-contribution/pdf",
    useMonth: true,
  },

  "Expense Report": {
    endpoint: "/expenses",
    useMonth: true,
  },

  "Fines Report": {
    endpoint: "/fines",
    pdfEndpoint: "/fine-contributions/pdf",
    useMonth: true,
  },

  "Outstanding Report": {
    endpoint: "/outstanding",
    useMonth: true,
  },

  "Attendance Report": {
    endpoint: "/attendance",
    useMonth: true,
  },
};

let activeReportType = "Monthly Report";
let latestReportData = null;
let systemSettings = {
  organizationName: "WELFARE & INVESTMENT",
  organizationEmail: "",
  organizationPhone: "",
  currency: "KES",
};

// DOM ELEMENTS
const modal = document.getElementById("reportModal");
const outputDiv = document.getElementById("reportOutput");

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const memberSelect = document.getElementById("memberSelect");

const memberContainer = document.getElementById("memberSelectContainer");
const exportButtons = document.getElementById("reportExportButtons");

// AUTHENTICATION
function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// SAFE HTML OUTPUT
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function money(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// FETCH JSON
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch report");
  }

  return data;
}

// LOAD SYSTEM SETTINGS
async function loadSystemSettings() {
  try {
    const response = await fetchJSON(SETTINGS_API);
    if (response.success && response.data) {
      systemSettings = { ...systemSettings, ...response.data };
    }
  } catch (error) {
    console.error("Failed to load system settings:", error);
  }
}

// Initialize settings on load
loadSystemSettings();

// OPEN REPORT MODAL
function openReportModal(reportType) {
  if (!REPORT_CONFIG[reportType]) {
    console.error("Unknown report:", reportType);
    return;
  }

  activeReportType = reportType;
  latestReportData = null;

  document.getElementById("modalReportTitle").textContent = reportType;

  outputDiv.style.display = "none";
  outputDiv.innerHTML = "";
  exportButtons.style.display = "none";

  const config = REPORT_CONFIG[reportType];

  monthSelect.style.display = config.useMonth === false ? "none" : "block";
  monthSelect.parentElement.style.display =
    config.useMonth === false ? "none" : "flex";

  memberContainer.style.display = config.requiresMember ? "flex" : "none";

  modal.classList.add("show");

  if (config.requiresMember) {
    loadMembersDropdown();
  }
}

// CLOSE MODAL
function closeReportModal() {
  modal.classList.remove("show");
}

document
  .getElementById("closeReportModal")
  .addEventListener("click", closeReportModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeReportModal();
  }
});

// REPORT CARD CLICK EVENTS
document.querySelectorAll("[data-report]").forEach((card) => {
  card.addEventListener("click", () => {
    const reportType = card.dataset.report;

    document
      .querySelectorAll("[data-report]")
      .forEach((item) => item.classList.remove("active"));

    card.classList.add("active");

    openReportModal(reportType);
  });
});

// LOAD MEMBERS
async function loadMembersDropdown() {
  memberSelect.innerHTML = `<option value="">Loading members...</option>`;

  try {
    const data = await fetchJSON(MEMBERS_API);
    const members = data.members || [];

    if (!members.length) {
      memberSelect.innerHTML = `<option value="">No members found</option>`;
      return;
    }

    memberSelect.innerHTML = `<option value="">-- Select Member --</option>`;

    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member._id;
      option.textContent = `${member.memberNumber || ""} - ${member.fullName || ""}`;
      memberSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Members error:", error);
    memberSelect.innerHTML = `<option value="">Failed to load members</option>`;
  }
}

// GENERATE REPORT
document
  .getElementById("generateBtn")
  .addEventListener("click", fetchAndRenderReport);

async function fetchAndRenderReport() {
  const config = REPORT_CONFIG[activeReportType];
  if (!config) return;

  const month = monthSelect.value;
  const year = yearSelect.value;
  const memberId = memberSelect.value;

  if (config.requiresMember && !memberId) {
    alert("Please select a member first.");
    return;
  }

  let path = `${API_BASE}${config.endpoint}`;

  if (config.requiresMember) {
    path += `/${encodeURIComponent(memberId)}`;
  }

  const url = new URL(path);

  if (config.query) {
    Object.entries(config.query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  if (config.useMonth && month) {
    url.searchParams.set("month", month);
  }

  if (year) {
    url.searchParams.set("year", year);
  }

  outputDiv.style.display = "block";
  outputDiv.innerHTML = `<p>Loading ${escapeHTML(activeReportType)}...</p>`;
  exportButtons.style.display = "none";

  try {
    const data = await fetchJSON(url.toString());
    latestReportData = data;
    renderReportUI(data);
    exportButtons.style.display = "flex";
  } catch (error) {
    console.error("Report error:", error);
    outputDiv.innerHTML = `
      <p style="color:#dc2626;">
        ${escapeHTML(error.message)}
      </p>
    `;
  }
}

// RENDER REPORT
function renderReportUI(data) {
  const orgName = escapeHTML(
    systemSettings.organizationName || "WELFARE & INVESTMENT",
  );
  const currency = escapeHTML(systemSettings.currency || "KES");
  const contactParts = [
    systemSettings.organizationEmail,
    systemSettings.organizationPhone,
  ]
    .filter(Boolean)
    .map(escapeHTML);
  const contactLine = contactParts.length
    ? `<p>${contactParts.join(" | ")}</p>`
    : "";

  let html = `
    <div class="report-document">
      <div class="report-heading">
        <h2>${orgName.toUpperCase()}</h2>
        ${contactLine}
        <h3>GROUP FINANCIAL REPORT</h3>
        <p>${escapeHTML(activeReportType)}</p>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
      </div>
  `;

  // 1. FINANCIAL SUMMARY
  if (
    data.investment &&
    data.welfare &&
    data.fines &&
    !Array.isArray(data.fines)
  ) {
    const funds = [
      {
        name: "Investment (SACCO)",
        received: data.investment.total,
        used: 0,
        balance: data.investment.total,
        note: "Restricted",
      },
      {
        name: "Welfare Fund",
        received: data.welfare.totalReceived,
        used: data.welfare.totalUsed,
        balance: data.welfare.balance,
      },
      {
        name: "Fines Fund",
        received: data.fines.totalReceived,
        used: data.fines.totalUsed,
        balance: data.fines.balance,
      },
    ];

    html += `
      <h3>Financial Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Fund Category</th>
            <th>Total Received</th>
            <th>Total Used</th>
            <th>Available Balance</th>
          </tr>
        </thead>
        <tbody>
          ${funds
            .map(
              (f) => `
            <tr>
              <td>${escapeHTML(f.name)}</td>
              <td>${currency} ${money(f.received)}</td>
              <td>${currency} ${money(f.used)}</td>
              <td>${currency} ${money(f.balance)}
                ${f.note ? `(${escapeHTML(f.note)})` : ""}
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  // 2. PAYMENTS
  if (Array.isArray(data.payments)) {
    html += buildTable(
      "Contribution Records",
      ["Member No", "Full Name", "Type", `Amount (${currency})`, "Date"],
      data.payments.map((p) => [
        p.member?.memberNumber || "-",
        p.member?.fullName || "-",
        p.paymentType || "-",
        money(p.amount),
        p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-",
      ]),
    );
  }

  // 3. FINES
  if (Array.isArray(data.fines)) {
    html += buildTable(
      "Fine Records",
      ["Member No", "Full Name", "Fine Type", `Amount (${currency})`, "Status"],
      data.fines.map((f) => [
        f.member?.memberNumber || "-",
        f.member?.fullName || "-",
        f.fineType || f.reason || "-",
        money(f.amount),
        f.paymentStatus || f.status || "Pending",
      ]),
    );
  }
  // 4. EXPENSES
  if (Array.isArray(data.expenses)) {
    html += buildTable(
      "Expense Records",
      [
        "Description",
        Amount(`${currency}`),
        "Welfare Used",
        "Fines Used",
        "Date",
      ],
      data.expenses.map((e) => [
        e.description || e.title || "-",
        money(e.amount),
        money(e.fundAllocation?.welfare),
        money(e.fundAllocation?.fine),
        e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : "-",
      ]),
    );
  }
  // 5. OUTSTANDING MEMBERS
  const unpaidMembers = data.unpaidMembers || data.members || [];
  if (Array.isArray(unpaidMembers) && unpaidMembers.length) {
    html += buildTable(
      "Outstanding Members",
      ["Member No", "Full Name", "Phone Number"],
      unpaidMembers.map((m) => [
        m.memberNumber || "-",
        m.fullName || "-",
        m.phoneNumber || "-",
      ]),
    );
  }
  // 6. MEMBER STATEMENT
  if (data.member) {
    html += `<h3>Member Information</h3> <p> <strong>Name:</strong> ${escapeHTML(data.member.fullName || "-")} </p> <p> <strong>Member Number:</strong> ${escapeHTML(data.member.memberNumber || "-")} </p>`;
  }
  html += `<div class="report-footer"> <p>${orgName}</p> <p>Official Group Financial Records</p> </div> </div>`;
  outputDiv.innerHTML = html;
}
// REUSABLE TABLE BUILDER
function buildTable(title, headers, rows) {
  if (!rows.length) {
    return `<h3>${escapeHTML(title)}</h3> <p>No records found for this period.</p>`;
  }
  return `
${escapeHTML(title)}
{headers.map((h) => <th>{escapeHTML(h)}</th>).join("")};
${rows
  .map(
    (row) => `
{row.map((cell) => <td>${escapeHTML(cell)}</td>).join("")}
`,
  )
  .join("")}
`;
}
// DOWNLOAD PDF
document
  .getElementById("downloadPdfBtn")
  .addEventListener("click", downloadPDF);
async function downloadPDF() {
  const config = REPORT_CONFIG[activeReportType];
  if (!latestReportData) {
    alert("Generate the report first.");
    return;
  }
  if (config.pdfEndpoint) {
    let path = `${API_BASE}${config.pdfEndpoint}`;
    if (config.requiresMember) {
      path += `/${encodeURIComponent(memberSelect.value)}`;
    }
    const url = new URL(path);
    if (config.query) {
      Object.entries(config.query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    if (config.useMonth && monthSelect.value) {
      url.searchParams.set("month", monthSelect.value);
    }
    if (yearSelect.value) {
      url.searchParams.set("year", yearSelect.value);
    }
    try {
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("PDF generation failed.");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${activeReportType.replace(/\s+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print the report.");
    return;
  }
  printWindow.document.write(
    `<!DOCTYPE html> <html> <head> <title>${escapeHTML(systemSettings.organizationName || "Report")} - ${escapeHTML(activeReportType)}</title> <style> body { font-family: Arial, sans-serif; padding: 25px; color: #1e293b; } table { width: 100%; border-collapse: collapse; margin-top: 15px; } th, td { border: 1px solid #ddd; padding: 9px; text-align: left; } th { background: #eee; } .report-heading { text-align: center; margin-bottom: 25px; } </style> </head> <body> ${outputDiv.innerHTML} </body> </html>`,
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
// EXPORT EXCEL
document
  .getElementById("exportExcelBtn")
  .addEventListener("click", exportExcel);
function exportExcel() {
  if (!latestReportData) {
    alert("Generate a report first.");
    return;
  }
  if (typeof XLSX === "undefined") {
    alert("Excel export library is not loaded.");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const data = latestReportData;
  if (
    data.investment &&
    data.welfare &&
    data.fines &&
    !Array.isArray(data.fines)
  ) {
    const summary = [
      ["Fund Category", "Total Received", "Total Used", "Balance"],
      ["Investment", data.investment.total || 0, 0, data.investment.total || 0],
      [
        "Welfare",
        data.welfare.totalReceived || 0,
        data.welfare.totalUsed || 0,
        data.welfare.balance || 0,
      ],
      [
        "Fines",
        data.fines.totalReceived || 0,
        data.fines.totalUsed || 0,
        data.fines.balance || 0,
      ],
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(summary),
      "Financial Summary",
    );
  }
  const sheets = [
    ["Payments", data.payments],
    ["Fines", data.fines],
    ["Expenses", data.expenses],
    ["Outstanding", data.unpaidMembers],
  ];
  sheets.forEach(([sheetName, records]) => {
    if (!Array.isArray(records) || !records.length) return;
    const cleanRecords = records.map((item) => ({
      ...item,
      member: item.member?.fullName || item.member || "",
      memberNumber: item.member?.memberNumber || "",
      recordedBy: item.recordedBy?.fullName || item.recordedBy || "",
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(cleanRecords),
      sheetName,
    );
  });
  XLSX.writeFile(workbook, `${activeReportType.replace(/\s+/g, "_")}.xlsx`);
}

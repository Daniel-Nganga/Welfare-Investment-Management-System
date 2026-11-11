document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    // Decode token to get basic details
    const tokenParts = token.split(".");
    const payload = JSON.parse(
      atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const userId = payload.id || payload._id;
    const role = String(payload.role || "").toLowerCase();

    if (!userId || !["admin", "member"].includes(role)) {
      console.error("User ID or role is missing from the token.");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // Fetch the logged-in user's profile
    const profileRes = await fetch(`/api/member/${userId}`, { headers });
    if (!profileRes.ok) throw new Error("Could not load your profile.");

    const profileData = await profileRes.json();
    const user = profileData.user;
    if (!user) throw new Error("User profile was not returned.");

    const actualRole = String(user.role || role).toLowerCase();

    // --- ROLE CONDITIONAL LOGIC FOR API REQUESTS ---
    let requests = [];

    // Only Admins pull global expense data and the complete members directory
    if (actualRole === "admin") {
      requests = [
        fetch("/api/saving/all", { headers }),
        fetch("/api/fines/all", { headers }),
        fetch("/api/expenses/all", { headers }),
        fetch("/api/member/all", { headers }),
      ];
    } else {
      requests = [
        fetch("/api/saving/member", { headers }),
        fetch(`/api/fines/member/${userId}`, { headers }),
      ];
    }

    const responses = await Promise.all(requests);
    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`Dashboard API failed with status ${response.status}`);
      }
    }

    // Parse datasets safely based on role
    let paymentsData, finesData;
    let expensesData = { expenses: [] };
    let membersData = { members: [] };

    if (actualRole === "admin") {
      paymentsData = await responses[0].json();
      finesData = await responses[1].json();
      expensesData = await responses[2].json();
      membersData = await responses[3].json();
    } else {
      paymentsData = await responses[0].json();
      finesData = await responses[1].json();
    }

    // Normalize records to arrays
    const allPayments = Array.isArray(paymentsData.payments)
      ? paymentsData.payments
      : [];
    const allFines = Array.isArray(finesData.fines) ? finesData.fines : [];
    const expenses = Array.isArray(expensesData.expenses)
      ? expensesData.expenses
      : [];
    const members = membersData.members || [];

    // --- ROLE CONDITIONAL LOGIC FOR DATA FILTERING ---
    let payments, fines;

    if (actualRole === "admin") {
      // Admin sees everything returned by the server
      payments = allPayments;
      fines = allFines;
    } else {
      // Member sees only their matching records (fallback defense mechanism)
      const matchesUser = (record) => {
        const recordMemberId =
          typeof record.member === "object"
            ? record.member?._id
            : record.member;
        return String(recordMemberId || "") === String(user._id);
      };
      payments = allPayments.filter(matchesUser);
      fines = allFines.filter(matchesUser);
    }

    // --- Calculate dashboard totals ---
    const totalInvestment = payments.reduce((sum, p) => {
      const type = String(p.paymentType || "").toLowerCase();
      return type === "investment" || type === "savings"
        ? sum + Number(p.amount || 0)
        : sum;
    }, 0);

    const totalWelfare = payments.reduce((sum, p) => {
      return String(p.paymentType || "").toLowerCase() === "welfare"
        ? sum + Number(p.amount || 0)
        : sum;
    }, 0);

    const totalFines = fines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0,
    );
    const totalBalance = totalWelfare + totalFines - totalExpenses;

    // --- Update UI Cards ---
    document.getElementById("memberProfileName").textContent =
      user.fullName || "User";
    document.getElementById("memberRole").textContent =
      actualRole.toUpperCase();
    document.getElementById("TotalMembers").textContent =
      actualRole === "admin" ? members.length : "—";
    document.getElementById("TotalInvestment").textContent =
      `KSh ${totalInvestment.toLocaleString()}`;
    document.getElementById("TotalWelfare").textContent =
      `KSh ${totalWelfare.toLocaleString()}`;
    document.getElementById("TotalFines").textContent =
      `KSh ${totalFines.toLocaleString()}`;
    document.getElementById("TotalExpenses").textContent =
      actualRole === "admin"
        ? `KSh ${totalExpenses.toLocaleString()}`
        : "Admin only";
    document.getElementById("TotalBalance").textContent =
      actualRole === "admin" ? `KSh ${totalBalance.toLocaleString()}` : "—";
    const topbarImage = document.getElementById("topbarProfilePicture");

    if (topbarImage) {
      topbarImage.src = user.profilePicture
        ? user.profilePicture
        : "https://i.pravatar.cc/100?img=12";
    }

    // --- Build & Render Transactions Stack ---
    const transactions = [
      ...payments.map((p) => ({
        date: p.paymentDate || p.createdAt,
        name: p.member?.fullName || user.fullName,
        type: p.paymentType || "Contribution",
        amount: Number(p.amount || 0),
        status: "Paid",
      })),
      ...fines.map((f) => ({
        date: f.createdAt,
        name: f.member?.fullName || user.fullName,
        type: `Fine (${f.fineType || "Other"})`,
        amount: Number(f.amount || 0),
        status: f.paymentStatus || "Pending",
      })),
    ];

    if (actualRole === "admin") {
      transactions.push(
        ...expenses.map((e) => ({
          date: e.expenseDate || e.createdAt,
          name: e.recordedBy?.fullName || "Group",
          type: `Expense (${e.expenseType || "Other"})`,
          amount: Number(e.amount || 0),
          status: "Expense",
        })),
      );
    }

    transactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    populateRecentTransactionsTable(transactions.slice(0, 4));

    updatePieChartBreakdown(totalInvestment, totalWelfare);
    buildMonthlyBarChart(payments);

    // Toggle view elements
    document
      .querySelectorAll(".admin-only")
      .forEach((el) => (el.hidden = actualRole !== "admin"));
    document
      .querySelectorAll(".member-only")
      .forEach((el) => (el.hidden = actualRole !== "member"));
  } catch (error) {
    console.error("Dashboard loading failed:", error);
  }
}

// POPULATE RECENT TRANSACTIONS TABLE ---
// --- HELPER FUNCTION: POPULATE RECENT TRANSACTIONS TABLE ---
function populateRecentTransactionsTable(transactions) {
  // Find or create recent transactions wrapper container if not explicitly present
  let tableBody = document.getElementById("recentTransactionsBody");

  if (!tableBody) {
    // Fallback: If your HTML doesn't have the table element yet, let's append one dynamically
    const chartsRow = document.querySelector(".charts-row");
    if (chartsRow) {
      const tableCard = document.createElement("div");
      tableCard.className = "chart-card";
      tableCard.style.marginTop = "20px";
      tableCard.innerHTML = `
        <h3>Recent Transactions</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 0.85rem;">
              <th style="padding: 10px 5px;">Date</th>
              <th style="padding: 10px 5px;">Name</th>
              <th style="padding: 10px 5px;">Type</th>
              <th style="padding: 10px 5px;">Amount</th>
              <th style="padding: 10px 5px;">Status</th>
            </tr>
          </thead>
          <tbody id="recentTransactionsBody"></tbody>
        </table>
      `;
      chartsRow.parentNode.insertBefore(tableCard, chartsRow.nextSibling);
      tableBody = document.getElementById("recentTransactionsBody");
    }
  }

  if (!tableBody) return;
  tableBody.innerHTML = ""; // Clean structural rows

  if (transactions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-center; padding: 15px; color: #64748b;">No recent transactions found</td></tr>`;
    return;
  }

  transactions.forEach((tx) => {
    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid #f1f5f9";
    row.style.fontSize = "0.9rem";

    const dateFormatted = tx.date
      ? new Date(tx.date).toLocaleDateString("en-KE")
      : "—";

    // Status colors mapped explicitly matching style.css properties
    let badgeColor = "#64748b";
    let badgeBg = "#f1f5f9";
    if (tx.status === "Paid") {
      badgeColor = "#15803d";
      badgeBg = "#dcfce7";
    }
    if (tx.status === "Pending") {
      badgeColor = "#b45309";
      badgeBg = "#fef3c7";
    }
    if (tx.status === "Expense") {
      badgeColor = "#b91c1c";
      badgeBg = "#fee2e2";
    }

    row.innerHTML = `
      <td style="padding: 12px 5px; color: #475569;">${dateFormatted}</td>
      <td style="padding: 12px 5px; font-weight: 500;">${tx.name || "—"}</td>
      <td style="padding: 12px 5px; color: #64748b;">${tx.type}</td>
      <td style="padding: 12px 5px;"><strong>KSh ${tx.amount.toLocaleString()}</strong></td>
      <td style="padding: 12px 5px;">
        <span style="padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; color: ${badgeColor}; background: ${badgeBg};">
          ${tx.status}
        </span>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// --- HELPER FUNCTION: DYNAMIC CSS MONTHLY BAR CHART POPULATION ---
function buildMonthlyBarChart(payments) {
  const chartContainer = document.querySelector(".bar-chart");
  if (!chartContainer) return;

  // 1. Group transaction sums strictly by month indexes
  const monthlyData = Array.from({ length: 12 }, () => ({
    investment: 0,
    welfare: 0,
  }));
  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  payments.forEach((p) => {
    if (!p.paymentDate && !p.createdAt) return;
    const date = new Date(p.paymentDate || p.createdAt);
    const monthIndex = date.getMonth(); // 0 to 11
    if (monthIndex < 0 || monthIndex > 11) return;

    const type = String(p.paymentType || "").toLowerCase();
    const amount = Number(p.amount || 0);

    if (type === "investment" || type === "savings") {
      monthlyData[monthIndex].investment += amount;
    } else if (type === "welfare") {
      monthlyData[monthIndex].welfare += amount;
    }
  });

  // 2. Find peak high value scale bounds to compute percentage heights cleanly
  let maxVal = 1000; // Safe baseline denominator minimum
  monthlyData.forEach((m) => {
    if (m.investment > maxVal) maxVal = m.investment;
    if (m.welfare > maxVal) maxVal = m.welfare;
  });

  // 3. Rebuild inner DOM structure dynamically mapping custom inline style heights
  chartContainer.innerHTML = "";

  monthlyData.forEach((data, index) => {
    const investHeight = Math.max(
      2,
      Math.round((data.investment / maxVal) * 100),
    );
    const welfareHeight = Math.max(
      2,
      Math.round((data.welfare / maxVal) * 100),
    );

    // Maintain your identical styling layout block signatures cleanly
    const barGroup = document.createElement("div");
    barGroup.className = "bar-group";
    barGroup.innerHTML = `
      <div class="bars">
        <div class="bar invest" style="height: ${investHeight}%;" title="Investment: KSh ${data.investment.toLocaleString()}"></div>
        <div class="bar welfare" style="height: ${welfareHeight}%;" title="Welfare: KSh ${data.welfare.toLocaleString()}"></div>
      </div>
      <span class="bar-label">${monthLabels[index]}</span>
    `;
    chartContainer.appendChild(barGroup);
  });
}

// --- HELPER FUNCTION: PIE CHART BREAKDOWN STUB ---
function updatePieChartBreakdown(totalInvestment, totalWelfare) {
  // Your HTML markup currently doesn't possess a donut/pie chart canvas element container yet.
  // We keep this call safe here as a operational hook so your console doesn't crash on reference limits.
  console.log(
    `Financial Proportions Logged -> Investment: KSh ${totalInvestment} | Welfare: KSh ${totalWelfare}`,
  );
}

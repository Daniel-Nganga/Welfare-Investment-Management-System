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
        fetch(`/api/saving/member/${userId}`, { headers }),
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
      : Array.isArray(paymentsData.memberPayments)
        ? paymentsData.memberPayments
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

    const topbarImage = document.getElementById("topbarProfilePicture");

    if (topbarImage) {
      topbarImage.src = user.profilePicture
        ? user.profilePicture
        : "https://i.pravatar.cc/100?img=12";
    }

    // --- Calculate Owed Balances (Sept 2025 to Date) ---
    const owed = calculateOwedBalances(payments, fines, members, actualRole);

    const balanceEl = document.getElementById("TotalBalance");
    if (balanceEl) {
      const card = balanceEl.closest(".mid-card");
      const titleEl = card ? card.querySelector("h4") : null;
      const subEl = card ? card.querySelector(".sub") : null;

      if (actualRole === "admin") {
        if (titleEl) titleEl.textContent = "Total Balance";
        balanceEl.textContent = `KSh ${totalBalance.toLocaleString()}`;
        if (subEl) {
          subEl.innerHTML = `<span class="owed-pill clear">Available</span>`;
        }
      } else {
        if (titleEl) titleEl.textContent = "Balance Owed";
        balanceEl.textContent = `KSh ${owed.totalOwed.toLocaleString()}`;

        if (subEl) {
          if (owed.totalOwed === 0) {
            subEl.innerHTML = `<span class="owed-pill clear">✓ Up to date</span>`;
          } else {
            subEl.innerHTML = `
              <span class="owed-pill">Inv: <strong>KSh ${owed.unpaidInvestment.toLocaleString()}</strong></span>
              <span class="owed-pill">Wel: <strong>KSh ${owed.unpaidWelfare.toLocaleString()}</strong></span>
              <span class="owed-pill fine">Fines: <strong>KSh ${owed.unpaidFines.toLocaleString()}</strong></span>
            `;
          }
        }
      }
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

    // Build charts using actual payments and member records
    buildMonthlyBarChart(payments, members, actualRole);

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

function calculateOwedBalances(payments, fines, members, role) {
  const startYear = 2025;
  const startMonth = 8; // September (0-indexed: Jan=0, Sept=8)
  const now = new Date();

  const elapsedMonths = Math.max(
    1,
    (now.getFullYear() - startYear) * 12 + (now.getMonth() - startMonth) + 1,
  );

  const activeMembersCount =
    role === "admin"
      ? members.filter(
          (m) => !m.status || String(m.status).toLowerCase() === "active",
        ).length
      : 1;

  const expectedInvestment =
    elapsedMonths * CONTRIBUTION_RULES.investment * activeMembersCount;
  const expectedWelfare =
    elapsedMonths * CONTRIBUTION_RULES.welfare * activeMembersCount;

  const sept2025 = new Date(2025, 8, 1);

  const paidInvestment = payments.reduce((sum, p) => {
    const pDate = new Date(p.paymentDate || p.createdAt);
    const type = String(p.paymentType || "").toLowerCase();
    if (pDate >= sept2025 && (type === "investment" || type === "savings")) {
      return sum + Number(p.amount || 0);
    }
    return sum;
  }, 0);

  const paidWelfare = payments.reduce((sum, p) => {
    const pDate = new Date(p.paymentDate || p.createdAt);
    const type = String(p.paymentType || "").toLowerCase();
    if (pDate >= sept2025 && type === "welfare") {
      return sum + Number(p.amount || 0);
    }
    return sum;
  }, 0);

  const unpaidInvestment = Math.max(0, expectedInvestment - paidInvestment);
  const unpaidWelfare = Math.max(0, expectedWelfare - paidWelfare);

  const unpaidFines = fines.reduce((sum, f) => {
    const status = String(f.paymentStatus || "pending").toLowerCase();
    return status !== "paid" ? sum + Number(f.amount || 0) : sum;
  }, 0);

  const totalOwed = unpaidInvestment + unpaidWelfare + unpaidFines;

  return {
    elapsedMonths,
    unpaidInvestment,
    unpaidWelfare,
    unpaidFines,
    totalOwed,
  };
}

// ========================================
// OFFICIAL MONTHLY CONTRIBUTION RULES
// ========================================

const CONTRIBUTION_RULES = {
  investment: 1400,
  welfare: 250,
};

const formatMoney = (amount) =>
  `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;

// ========================================
// MONTHLY CONTRIBUTION BAR CHART
// ========================================

function buildMonthlyBarChart(payments, members, role) {
  const chartContainer = document.getElementById("monthlyContributionChart");

  const summaryContainer = document.getElementById(
    "monthlyContributionSummary",
  );

  if (!chartContainer) return;

  const currentYear = new Date().getFullYear();

  // Count active members for the group target.
  // A member dashboard uses one member as its target.
  const activeMembers =
    role === "admin"
      ? members.filter(
          (member) =>
            !member.status || String(member.status).toLowerCase() === "active",
        ).length
      : 1;

  // Expected monthly group contributions
  const investmentTarget = activeMembers * CONTRIBUTION_RULES.investment;

  const welfareTarget = activeMembers * CONTRIBUTION_RULES.welfare;

  const totalTarget = investmentTarget + welfareTarget;

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

  // Read actual contribution records
  payments.forEach((payment) => {
    const paymentDate = payment.paymentDate || payment.createdAt;

    if (!paymentDate) return;

    const date = new Date(paymentDate);

    if (isNaN(date.getTime())) return;

    // Only display payments from the current year
    if (date.getFullYear() !== currentYear) return;

    const month = date.getMonth();

    const type = String(payment.paymentType || "").toLowerCase();

    const amount = Number(payment.amount || 0);

    if (type === "investment" || type === "savings") {
      monthlyData[month].investment += amount;
    }

    if (type === "welfare") {
      monthlyData[month].welfare += amount;
    }
  });

  // Determine chart scale using actual and expected amounts
  const maxValue = Math.max(
    investmentTarget,
    welfareTarget,
    ...monthlyData.map((m) => Math.max(m.investment, m.welfare)),
    1,
  );

  chartContainer.innerHTML = "";

  monthlyData.forEach((data, index) => {
    const investmentHeight = (data.investment / maxValue) * 100;

    const welfareHeight = (data.welfare / maxValue) * 100;

    const investmentPercentage = investmentTarget
      ? Math.round((data.investment / investmentTarget) * 100)
      : 0;

    const welfarePercentage = welfareTarget
      ? Math.round((data.welfare / welfareTarget) * 100)
      : 0;

    const barGroup = document.createElement("div");

    barGroup.className = "bar-group";

    barGroup.innerHTML = `
      <div class="bars">

        <div
          class="bar invest"
          style="height: ${investmentHeight}%"
          title="Investment: ${formatMoney(data.investment)}
Target: ${formatMoney(investmentTarget)}
Progress: ${investmentPercentage}%">
        </div>

        <div
          class="bar welfare"
          style="height: ${welfareHeight}%"
          title="Welfare: ${formatMoney(data.welfare)}
Target: ${formatMoney(welfareTarget)}
Progress: ${welfarePercentage}%">
        </div>

      </div>

      <span class="bar-label">
        ${monthLabels[index]}
      </span>
    `;

    chartContainer.appendChild(barGroup);
  });

  // Contribution target summary
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div style="
        margin-top: 15px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
        font-size: 0.85rem;
      ">

        <strong>${currentYear} Monthly Targets</strong>

        <p>
          Investment:
          ${formatMoney(investmentTarget)}
        </p>

        <p>
          Welfare:
          ${formatMoney(welfareTarget)}
        </p>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 8px 0">

        <strong>
          Total Expected:
          ${formatMoney(totalTarget)}
        </strong>

       

      </div>
    `;
  }
}

// ========================================
// CONTRIBUTION PIE CHART
// ========================================

function updatePieChartBreakdown(totalInvestment, totalWelfare) {
  const pie = document.getElementById("contributionPie");

  const legend = document.getElementById("PieLegend");

  const investment = Number(totalInvestment || 0);
  const welfare = Number(totalWelfare || 0);

  const total = investment + welfare;

  const investmentPercentage = total > 0 ? (investment / total) * 100 : 0;

  const welfarePercentage = total > 0 ? (welfare / total) * 100 : 0;

  if (pie) {
    pie.style.background =
      total > 0
        ? `conic-gradient(
          #3b82f6 0% ${investmentPercentage}%,
          #10b981 ${investmentPercentage}% 100%
        )`
        : "#e2e8f0";
  }

  if (legend) {
    legend.innerHTML = `
      <div>
        <span style="background:#3b82f6"></span>
        Investment

        <strong>${investmentPercentage.toFixed(1)}%</strong>

        <small>${formatMoney(investment)}</small>
      </div>

      <div>
        <span style="background:#10b981"></span>
        Welfare

        <strong>${welfarePercentage.toFixed(1)}%</strong>

        <small>${formatMoney(welfare)}</small>
      </div>

      <hr>

      <strong>
        Total Contributions: ${formatMoney(total)}
      </strong>
    `;
  }
}

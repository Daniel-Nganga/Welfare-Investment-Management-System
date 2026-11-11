const PDFDocument = require("pdfkit");
const Expense = require("../models/ExpenseModel");
const User = require("../models/userModel");
const PaymentInvestmentWelfare = require("../models/InvestmentWelfarepaymentModel");
const FinePayment = require("../models/finePaymentModel");
const Fine = require("../models/FineModel");

const MONTHLY_INVESTMENT = 1400;
const MONTHLY_WELFARE = 250;
const MONTHLY_TOTAL = 1650;

const REPORT_START_YEAR = 2025;
const REPORT_START_MONTH = 8; // September, JavaScript = 8

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getReportMonths() {
  const months = [];

  const start = new Date(REPORT_START_YEAR, REPORT_START_MONTH, 1);

  const now = new Date();

  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (start <= end) {
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
        2,
        "0",
      )}`,

      month: start.getMonth() + 1,

      year: start.getFullYear(),

      shortName: start.toLocaleString("en-US", {
        month: "short",
      }),

      name: start.toLocaleString("en-US", {
        month: "long",
      }),
    });

    start.setMonth(start.getMonth() + 1);
  }

  return months;
}

exports.generateFinancialPDF = async (req, res) => {
  try {
    // ==========================================
    // GET FINANCIAL DATA
    // ==========================================

    // Investment
    const investmentResult = await PaymentInvestmentWelfare.aggregate([
      {
        $match: {
          paymentType: "Investment",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalInvestment =
      investmentResult.length > 0 ? investmentResult[0].total : 0;

    // Welfare
    const welfareResult = await PaymentInvestmentWelfare.aggregate([
      {
        $match: {
          paymentType: "Welfare",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalWelfare = welfareResult.length > 0 ? welfareResult[0].total : 0;

    // Fine payments
    const fineResult = await FinePayment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalFine = fineResult.length > 0 ? fineResult[0].total : 0;

    // Expenses
    const expenses = await Expense.find()
      .populate("recordedBy", "memberNumber fullName")
      .sort({
        expenseDate: -1,
      });

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );

    const totalWelfareUsed = expenses.reduce(
      (total, expense) => total + (expense.fundAllocation?.welfare || 0),
      0,
    );

    const totalFineUsed = expenses.reduce(
      (total, expense) => total + (expense.fundAllocation?.fine || 0),
      0,
    );

    // ==========================================
    // BALANCES
    // ==========================================

    const welfareBalance = totalWelfare - totalWelfareUsed;

    const fineBalance = totalFine - totalFineUsed;

    const totalGroupFunds = totalWelfare + totalFine;

    const totalAvailable = welfareBalance + fineBalance;

    // ==========================================
    // MEMBERS
    // ==========================================

    const totalMembers = await User.countDocuments();

    const activeMembers = await User.countDocuments({
      status: "active",
    });

    const inactiveMembers = await User.countDocuments({
      status: "inactive",
    });

    // ==========================================
    // CREATE PDF
    // ==========================================

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    // ==========================================
    // PDF RESPONSE HEADERS
    // ==========================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Group_Financial_Report.pdf"',
    );

    doc.pipe(res);

    // ==========================================
    // COLORS
    // ==========================================

    const blue = "#1F4E78";
    const darkBlue = "#17365D";
    const lightBlue = "#D9EAF7";
    const lightGrey = "#F3F5F7";
    const green = "#E2F0D9";
    const yellow = "#FFF2CC";
    const red = "#F4CCCC";
    const grey = "#666666";

    // ==========================================
    // HEADER
    // ==========================================

    doc.fillColor(blue).rect(40, 35, 515, 75).fill();

    doc
      .fillColor("#FFFFFF")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("WELFARE & INVESTMENT", 55, 52, {
        width: 485,
        align: "center",
      });

    doc.fontSize(15).text("MANAGEMENT SYSTEM", 55, 78, {
      width: 485,
      align: "center",
    });

    doc
      .fillColor("#333333")
      .fontSize(10)
      .font("Helvetica")
      .text("GROUP FINANCIAL REPORT", 40, 125, {
        width: 515,
        align: "center",
      });

    const reportDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    doc
      .fontSize(9)
      .fillColor(grey)
      .text(`Report Date: ${reportDate}`, 40, 142, {
        width: 515,
        align: "center",
      });

    // ==========================================
    // SECTION TITLE FUNCTION
    // ==========================================

    const sectionTitle = (title) => {
      doc
        .fillColor(blue)
        .rect(40, doc.y + 10, 515, 25)
        .fill();

      doc
        .fillColor("#FFFFFF")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(title, 50, doc.y + 17);

      doc.moveDown(2);
    };

    // ==========================================
    // MEMBER SUMMARY
    // ==========================================

    sectionTitle("MEMBER SUMMARY");

    const memberY = doc.y;

    doc.fillColor(lightGrey).rect(40, memberY, 515, 45).fill();

    doc
      .fillColor("#333333")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Total Members", 55, memberY + 10);

    doc.font("Helvetica").text(totalMembers.toString(), 55, memberY + 25);

    doc.font("Helvetica-Bold").text("Active Members", 220, memberY + 10);

    doc.font("Helvetica").text(activeMembers.toString(), 220, memberY + 25);

    doc.font("Helvetica-Bold").text("Inactive Members", 390, memberY + 10);

    doc.font("Helvetica").text(inactiveMembers.toString(), 390, memberY + 25);

    doc.y = memberY + 60;

    // ==========================================
    // FINANCIAL SUMMARY
    // ==========================================

    sectionTitle("FINANCIAL SUMMARY");

    const summaryRows = [
      ["Financial Item", "Amount (KSh)"],

      ["Investment / SACCO Contributions", formatMoney(totalInvestment)],

      ["Welfare Contributions", formatMoney(totalWelfare)],

      ["Fine Collections", formatMoney(totalFine)],

      ["Total Group Funds", formatMoney(totalGroupFunds)],

      ["Total Expenses", formatMoney(totalExpenses)],

      ["Available Group Funds", formatMoney(totalAvailable)],
    ];

    drawTable(doc, summaryRows, [300, 215], {
      header: true,
      highlightLast: true,
    });

    doc.moveDown(2);

    // ==========================================
    // FUND BALANCES
    // ==========================================

    sectionTitle("FUND BALANCES");

    const fundRows = [
      ["Fund", "Received", "Used", "Balance"],

      [
        "Welfare",
        formatMoney(totalWelfare),
        formatMoney(totalWelfareUsed),
        formatMoney(welfareBalance),
      ],

      [
        "Fine",
        formatMoney(totalFine),
        formatMoney(totalFineUsed),
        formatMoney(fineBalance),
      ],
    ];

    drawTable(doc, fundRows, [130, 128, 128, 129], {
      header: true,
    });

    doc.moveDown(2);

    // ==========================================
    // EXPENSES
    // ==========================================

    sectionTitle("EXPENSE DETAILS");

    const expenseRows = [
      ["Date", "Type", "Description", "Amount", "Welfare", "Fine"],
    ];

    expenses.forEach((expense) => {
      const date = new Date(expense.expenseDate).toLocaleDateString("en-GB");

      expenseRows.push([
        date,
        expense.expenseType,
        expense.description,
        formatMoney(expense.amount),
        formatMoney(expense.fundAllocation?.welfare || 0),
        formatMoney(expense.fundAllocation?.fine || 0),
      ]);
    });

    drawTable(doc, expenseRows, [65, 80, 135, 75, 80, 80], {
      header: true,
      small: true,
    });

    doc.moveDown(2);

    // ==========================================
    // TOTALS
    // ==========================================

    sectionTitle("REPORT TOTALS");

    const totalsY = doc.y;

    doc.fillColor(green).rect(40, totalsY, 515, 65).fill();

    doc
      .fillColor("#333333")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Welfare Balance", 55, totalsY + 10);

    doc
      .font("Helvetica")
      .text(`KSh ${formatMoney(welfareBalance)}`, 55, totalsY + 28);

    doc.font("Helvetica-Bold").text("Fine Balance", 220, totalsY + 10);

    doc
      .font("Helvetica")
      .text(`KSh ${formatMoney(fineBalance)}`, 220, totalsY + 28);

    doc.font("Helvetica-Bold").text("Available Group Funds", 375, totalsY + 10);

    doc
      .font("Helvetica-Bold")
      .text(`KSh ${formatMoney(totalAvailable)}`, 375, totalsY + 28);

    doc.y = totalsY + 80;

    // ==========================================
    // ACCOUNTING NOTE
    // ==========================================

    doc.fillColor(yellow).rect(40, doc.y, 515, 50).fill();

    doc
      .fillColor("#333333")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("ACCOUNTING NOTE", 52, doc.y + 10);

    doc
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Investment contributions are SACCO funds and are not available for group expenses. Welfare and Fine collections are the funds used to finance group expenses.",
        52,
        doc.y + 25,
        {
          width: 490,
        },
      );

    doc.moveDown(4);

    // ==========================================
    // SIGNATURES
    // ==========================================

    sectionTitle("CERTIFICATION & SIGNATURES");

    doc
      .fillColor("#333333")
      .fontSize(9)
      .font("Helvetica")
      .text(
        "We certify that the financial information contained in this report is a true summary of the records maintained by the group for the reporting period.",
        40,
        doc.y,
        {
          width: 515,
          align: "left",
        },
      );

    doc.moveDown(4);

    const signatureY = doc.y;

    // Chairperson

    doc
      .moveTo(55, signatureY + 35)
      .lineTo(235, signatureY + 35)
      .strokeColor("#333333")
      .stroke();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Group Chairperson", 55, signatureY + 42, {
        width: 180,
        align: "center",
      });

    doc
      .font("Helvetica")
      .text("Date: __________________", 55, signatureY + 60, {
        width: 180,
        align: "center",
      });

    // Treasurer

    doc
      .moveTo(360, signatureY + 35)
      .lineTo(540, signatureY + 35)
      .stroke();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Treasurer", 360, signatureY + 42, {
        width: 180,
        align: "center",
      });

    doc
      .font("Helvetica")
      .text("Date: __________________", 360, signatureY + 60, {
        width: 180,
        align: "center",
      });

    // ==========================================
    // FOOTER
    // ==========================================

    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      doc
        .fontSize(8)
        .fillColor(grey)
        .text(
          `Welfare & Investment Management System  |  Page ${i + 1} of ${range.count}`,
          40,
          805,
          {
            width: 515,
            align: "center",
          },
        );
    }

    // ==========================================
    // FINISH PDF
    // ==========================================

    doc.end();
  } catch (error) {
    console.error("PDF Report Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Failed to generate financial PDF",
        error: error.message,
      });
    }
  }
};

// ==========================================
// FORMAT MONEY
// ==========================================

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ==========================================
// DRAW TABLE
// ==========================================

function drawTable(doc, rows, columnWidths, options = {}) {
  const startX = 40;
  let startY = doc.y;

  const rowHeight = options.small ? 24 : 30;

  rows.forEach((row, rowIndex) => {
    // New page if needed
    if (startY + rowHeight > 760) {
      doc.addPage();

      startY = 50;
    }

    let currentX = startX;

    row.forEach((cell, cellIndex) => {
      const width = columnWidths[cellIndex];

      // Header
      if (rowIndex === 0 && options.header) {
        doc
          .fillColor("#1F4E78")
          .rect(currentX, startY, width, rowHeight)
          .fill();

        doc.fillColor("#FFFFFF").font("Helvetica-Bold");
      }

      // Highlight last row
      else if (options.highlightLast && rowIndex === rows.length - 1) {
        doc
          .fillColor("#E2F0D9")
          .rect(currentX, startY, width, rowHeight)
          .fill();

        doc.fillColor("#333333").font("Helvetica-Bold");
      }

      // Normal row
      else {
        if (rowIndex % 2 === 0) {
          doc
            .fillColor("#F3F5F7")
            .rect(currentX, startY, width, rowHeight)
            .fill();
        }

        doc.fillColor("#333333").font("Helvetica");
      }

      // Border
      doc
        .strokeColor("#CCCCCC")
        .rect(currentX, startY, width, rowHeight)
        .stroke();

      // Text
      doc
        .fontSize(options.small ? 7 : 8)
        .text(String(cell), currentX + 5, startY + 9, {
          width: width - 10,
          height: rowHeight - 10,
          ellipsis: true,
        });

      currentX += width;
    });

    startY += rowHeight;
  });

  doc.y = startY + 5;
}

// ==========================================
// MONTHLY MEMBERS CONTRIBUTION REPORT
// September 2025 - Current Month
// ==========================================

exports.getMonthlyContributionReport = async (req, res) => {
  try {
    // ==========================================
    // CONTRIBUTION SETTINGS
    // ==========================================

    const MONTHLY_INVESTMENT = 1400;
    const MONTHLY_WELFARE = 250;

    const MONTHLY_EXPECTED = MONTHLY_INVESTMENT + MONTHLY_WELFARE;

    // Report starts September 2025
    const START_YEAR = 2025;
    const START_MONTH = 8; // September = 8 in JavaScript

    const today = new Date();

    const END_YEAR = today.getFullYear();
    const END_MONTH = today.getMonth();

    // ==========================================
    // GENERATE MONTHS
    // ==========================================

    const months = [];

    let year = START_YEAR;
    let month = START_MONTH;

    while (year < END_YEAR || (year === END_YEAR && month <= END_MONTH)) {
      const date = new Date(year, month, 1);

      months.push({
        year,
        month: month + 1,
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        name: date.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      });

      month++;

      if (month > 11) {
        month = 0;
        year++;
      }
    }

    // ==========================================
    // GET MEMBERS
    // ==========================================

    const members = await User.find()
      .select("memberNumber fullName phoneNumber status")
      .sort({ fullName: 1 });

    // ==========================================
    // GET PAYMENTS
    // ==========================================

    const payments = await PaymentInvestmentWelfare.find({
      paymentDate: {
        $gte: new Date(START_YEAR, START_MONTH, 1),
        $lte: new Date(END_YEAR, END_MONTH + 1, 0, 23, 59, 59),
      },
    })
      .populate("member", "memberNumber fullName phoneNumber")
      .sort({ paymentDate: 1 });

    // ==========================================
    // ORGANIZE PAYMENTS
    // ==========================================

    const paymentMap = {};

    payments.forEach((payment) => {
      if (!payment.member) return;

      const paymentDate = new Date(payment.paymentDate);

      const paymentYear = paymentDate.getFullYear();
      const paymentMonth = paymentDate.getMonth() + 1;

      const monthKey = `${paymentYear}-${String(paymentMonth).padStart(
        2,
        "0",
      )}`;

      const memberId = payment.member._id.toString();

      const key = `${memberId}_${monthKey}`;

      if (!paymentMap[key]) {
        paymentMap[key] = {
          investment: 0,
          welfare: 0,
        };
      }

      if (payment.paymentType === "Investment") {
        paymentMap[key].investment += Number(payment.amount || 0);
      }

      if (payment.paymentType === "Welfare") {
        paymentMap[key].welfare += Number(payment.amount || 0);
      }
    });

    // ==========================================
    // CREATE MEMBER REPORT
    // ==========================================

    const memberReports = members.map((member) => {
      const monthly = [];

      let totalInvestment = 0;
      let totalWelfare = 0;
      let totalExpected = 0;
      let totalPaid = 0;
      let totalBalance = 0;

      months.forEach((monthInfo) => {
        const key = `${member._id}_${monthInfo.key}`;

        const payment = paymentMap[key] || {
          investment: 0,
          welfare: 0,
        };

        const investment = payment.investment;
        const welfare = payment.welfare;

        const paid = investment + welfare;

        const expected = MONTHLY_EXPECTED;

        const balance = Math.max(expected - paid, 0);

        let status = "UNPAID";

        if (paid >= expected) {
          status = "PAID";
        } else if (paid > 0) {
          status = "PARTIAL";
        }

        monthly.push({
          month: monthInfo.name,
          monthKey: monthInfo.key,

          investment,
          welfare,

          expected,
          paid,
          balance,

          status,
        });

        totalInvestment += investment;
        totalWelfare += welfare;
        totalExpected += expected;
        totalPaid += paid;
        totalBalance += balance;
      });

      return {
        member: {
          id: member._id,
          memberNumber: member.memberNumber,
          fullName: member.fullName,
          phoneNumber: member.phoneNumber,
          status: member.status,
        },

        monthly,

        totals: {
          investment: totalInvestment,
          welfare: totalWelfare,
          expected: totalExpected,
          paid: totalPaid,
          balance: totalBalance,
        },
      };
    });

    // ==========================================
    // MONTHLY GROUP SUMMARY
    // ==========================================

    const monthlySummary = months.map((monthInfo) => {
      let investment = 0;
      let welfare = 0;

      memberReports.forEach((member) => {
        const month = member.monthly.find(
          (item) => item.monthKey === monthInfo.key,
        );

        if (month) {
          investment += month.investment;
          welfare += month.welfare;
        }
      });

      const expected = members.length * MONTHLY_EXPECTED;

      const paid = investment + welfare;

      const balance = Math.max(expected - paid, 0);

      return {
        month: monthInfo.name,
        monthKey: monthInfo.key,

        investment,
        welfare,

        expected,
        paid,
        balance,

        members: members.length,
      };
    });

    // ==========================================
    // GRAND TOTALS
    // ==========================================

    let totalInvestment = 0;
    let totalWelfare = 0;
    let totalExpected = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    memberReports.forEach((member) => {
      totalInvestment += member.totals.investment;
      totalWelfare += member.totals.welfare;
      totalExpected += member.totals.expected;
      totalPaid += member.totals.paid;
      totalBalance += member.totals.balance;
    });

    // ==========================================
    // RESPONSE
    // ==========================================

    res.status(200).json({
      message: "Monthly contribution report retrieved successfully",

      reportingPeriod: {
        start: "September 2025",
        end: today.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      },

      contributionSettings: {
        investment: MONTHLY_INVESTMENT,
        welfare: MONTHLY_WELFARE,
        monthlyExpected: MONTHLY_EXPECTED,
      },

      summary: {
        totalMembers: members.length,

        totalInvestment,
        totalWelfare,

        totalExpected,
        totalPaid,
        totalBalance,
      },

      monthlySummary,

      members: memberReports,
    });
  } catch (error) {
    console.error("Monthly Contribution Report Error:", error);

    res.status(500).json({
      message: "Failed to retrieve monthly contribution report",

      error: error.message,
    });
  }
};

// ==========================================
// MONTHLY CONTRIBUTION PDF
// September 2025 - Current Month
exports.generateMonthlyContributionPDF = async (req, res) => {
  try {
    const months = getReportMonths();

    const startDate = new Date(REPORT_START_YEAR, REPORT_START_MONTH, 1);

    const endDate = new Date();

    endDate.setHours(23, 59, 59, 999);

    // ------------------------------------------
    // GET MEMBERS
    // ------------------------------------------

    const members = await User.find({}).sort({ fullName: 1 });

    // ------------------------------------------
    // GET PAYMENTS
    // ------------------------------------------

    const payments = await PaymentInvestmentWelfare.find({
      paymentDate: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({
      paymentDate: 1,
      createdAt: 1,
    });

    // ------------------------------------------
    // GROUP PAYMENTS BY MEMBER
    // ------------------------------------------

    const paymentsByMember = {};

    payments.forEach((payment) => {
      const memberId = payment.member.toString();

      if (!paymentsByMember[memberId]) {
        paymentsByMember[memberId] = {
          Investment: [],
          Welfare: [],
        };
      }

      if (payment.paymentType === "Investment") {
        paymentsByMember[memberId].Investment.push(payment);
      }

      if (payment.paymentType === "Welfare") {
        paymentsByMember[memberId].Welfare.push(payment);
      }
    });

    // ==========================================
    // BUILD MEMBER REPORT
    // ==========================================

    const memberReports = [];

    for (const member of members) {
      const memberId = member._id.toString();

      const memberPayments = paymentsByMember[memberId] || {
        Investment: [],
        Welfare: [],
      };

      // --------------------------------------
      // Investment payments
      // --------------------------------------

      let investmentPayments = memberPayments.Investment.map((p) => ({
        amount: Number(p.amount || 0),
      }));

      // --------------------------------------
      // Welfare payments
      // --------------------------------------

      let welfarePayments = memberPayments.Welfare.map((p) => ({
        amount: Number(p.amount || 0),
      }));

      let investmentIndex = 0;
      let welfareIndex = 0;

      let investmentRemaining = investmentPayments.length
        ? investmentPayments[0].amount
        : 0;

      let welfareRemaining = welfarePayments.length
        ? welfarePayments[0].amount
        : 0;

      const monthlyData = [];

      let totalInvestmentPaid = 0;
      let totalWelfarePaid = 0;

      // ======================================
      // MONTH BY MONTH
      // ======================================

      for (const month of months) {
        let investmentPaid = 0;
        let welfarePaid = 0;

        // ----------------------------------
        // APPLY INVESTMENT TO OLDEST MONTH
        // ----------------------------------

        let investmentBalance = MONTHLY_INVESTMENT;

        while (
          investmentBalance > 0 &&
          investmentIndex < investmentPayments.length
        ) {
          if (investmentRemaining <= 0) {
            investmentIndex++;

            if (investmentIndex < investmentPayments.length) {
              investmentRemaining = investmentPayments[investmentIndex].amount;
            }

            continue;
          }

          const amount = Math.min(investmentBalance, investmentRemaining);

          investmentPaid += amount;

          investmentBalance -= amount;

          investmentRemaining -= amount;

          totalInvestmentPaid += amount;
        }

        // ----------------------------------
        // APPLY WELFARE TO OLDEST MONTH
        // ----------------------------------

        let welfareBalance = MONTHLY_WELFARE;

        while (welfareBalance > 0 && welfareIndex < welfarePayments.length) {
          if (welfareRemaining <= 0) {
            welfareIndex++;

            if (welfareIndex < welfarePayments.length) {
              welfareRemaining = welfarePayments[welfareIndex].amount;
            }

            continue;
          }

          const amount = Math.min(welfareBalance, welfareRemaining);

          welfarePaid += amount;

          welfareBalance -= amount;

          welfareRemaining -= amount;

          totalWelfarePaid += amount;
        }

        const balance = MONTHLY_TOTAL - investmentPaid - welfarePaid;

        monthlyData.push({
          key: month.key,
          shortName: month.shortName,
          year: month.year,

          investmentPaid,
          welfarePaid,

          expected: MONTHLY_TOTAL,

          balance: Math.max(balance, 0),
        });
      }

      const totalExpected = months.length * MONTHLY_TOTAL;

      const totalPaid = totalInvestmentPaid + totalWelfarePaid;

      const totalBalance = Math.max(totalExpected - totalPaid, 0);

      memberReports.push({
        member,

        monthlyData,

        totalExpected,

        totalInvestmentPaid,

        totalWelfarePaid,

        totalPaid,

        totalBalance,
      });
    }

    // ==========================================
    // CREATE PDF
    // ==========================================

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 25,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      "inline; filename=Monthly_Contribution_Report.pdf",
    );

    doc.pipe(res);

    // ==========================================
    // HEADER
    // ==========================================

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text("WELFARE & INVESTMENT MANAGEMENT SYSTEM", {
        align: "center",
      });

    doc
      .fontSize(12)
      .fillColor("#222")
      .text("MONTHLY INVESTMENT & WELFARE CONTRIBUTION REPORT", {
        align: "center",
      });

    doc.moveDown(0.3);

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#555")
      .text(
        `Period: ${months[0].name} ${months[0].year} - ${
          months[months.length - 1].name
        } ${months[months.length - 1].year}`,
        {
          align: "center",
        },
      );

    doc.moveDown();

    // ==========================================
    // SUMMARY
    // ==========================================

    const grandExpected = memberReports.reduce(
      (sum, r) => sum + r.totalExpected,
      0,
    );

    const grandInvestment = memberReports.reduce(
      (sum, r) => sum + r.totalInvestmentPaid,
      0,
    );

    const grandWelfare = memberReports.reduce(
      (sum, r) => sum + r.totalWelfarePaid,
      0,
    );

    const grandPaid = grandInvestment + grandWelfare;

    const grandBalance = Math.max(grandExpected - grandPaid, 0);

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text(
        `Members: ${members.length}    ` +
          `Monthly Investment: KSh ${formatMoney(MONTHLY_INVESTMENT)}    ` +
          `Monthly Welfare: KSh ${formatMoney(MONTHLY_WELFARE)}    ` +
          `Expected: KSh ${formatMoney(grandExpected)}    ` +
          `Paid: KSh ${formatMoney(grandPaid)}    ` +
          `Balance: KSh ${formatMoney(grandBalance)}`,
      );

    doc.moveDown();

    // ==========================================
    // TABLE SETTINGS
    // ==========================================

    const pageWidth = 842;

    const left = 20;

    const memberWidth = 105;

    const totalWidth = 65;

    const availableWidth = pageWidth - left * 2 - memberWidth - totalWidth;

    const monthWidth = availableWidth / months.length;

    const subWidth = monthWidth / 3;

    let y = doc.y;

    // ==========================================
    // MONTH HEADER
    // ==========================================

    doc.rect(left, y, memberWidth, 38).fill("#174A7E");

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("MEMBER", left + 3, y + 14, {
        width: memberWidth - 6,
        align: "center",
      });

    let x = left + memberWidth;

    months.forEach((month) => {
      doc.rect(x, y, monthWidth, 18).fill("#174A7E");

      doc
        .fontSize(6)
        .fillColor("#FFFFFF")
        .text(`${month.shortName} ${month.year}`, x, y + 5, {
          width: monthWidth,
          align: "center",
        });

      doc.rect(x, y + 18, monthWidth, 20).fill("#2C6595");

      doc
        .fontSize(5)
        .fillColor("#FFFFFF")
        .text("INV", x, y + 25, {
          width: subWidth,
          align: "center",
        });

      doc.text("WEL", x + subWidth, y + 25, {
        width: subWidth,
        align: "center",
      });

      doc.text("BAL", x + subWidth * 2, y + 25, {
        width: subWidth,
        align: "center",
      });

      x += monthWidth;
    });

    // Total balance header

    doc.rect(x, y, totalWidth, 38).fill("#174A7E");

    doc
      .fontSize(6)
      .fillColor("#FFFFFF")
      .text("TOTAL\nBALANCE", x, y + 10, {
        width: totalWidth,
        align: "center",
      });

    y += 38;

    // ==========================================
    // MEMBER ROWS
    // ==========================================

    memberReports.forEach((report) => {
      if (y > 560) {
        doc.addPage();

        y = 35;

        // Header on new page
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#174A7E")
          .text("MONTHLY MEMBER CONTRIBUTION REPORT");

        y = doc.y + 10;
      }

      // Member cell

      doc.rect(left, y, memberWidth, 24).stroke("#CCCCCC");

      doc
        .fontSize(6)
        .font("Helvetica-Bold")
        .fillColor("#222")
        .text(
          report.member.fullName || report.member.name || "Unknown Member",
          left + 3,
          y + 8,
          {
            width: memberWidth - 6,
            align: "left",
          },
        );

      let cellX = left + memberWidth;

      report.monthlyData.forEach((data) => {
        // Investment

        doc.rect(cellX, y, subWidth, 24).stroke("#CCCCCC");

        doc
          .fontSize(5.5)
          .font("Helvetica")
          .fillColor("#222")
          .text(formatMoney(data.investmentPaid), cellX, y + 8, {
            width: subWidth,
            align: "center",
          });

        // Welfare

        doc.rect(cellX + subWidth, y, subWidth, 24).stroke("#CCCCCC");

        doc.text(formatMoney(data.welfarePaid), cellX + subWidth, y + 8, {
          width: subWidth,
          align: "center",
        });

        // Balance

        doc.rect(cellX + subWidth * 2, y, subWidth, 24).stroke("#CCCCCC");

        doc.text(formatMoney(data.balance), cellX + subWidth * 2, y + 8, {
          width: subWidth,
          align: "center",
        });

        cellX += monthWidth;
      });

      // Total balance

      doc.rect(cellX, y, totalWidth, 24).stroke("#CCCCCC");

      doc
        .fontSize(6)
        .font("Helvetica-Bold")
        .text(formatMoney(report.totalBalance), cellX, y + 8, {
          width: totalWidth,
          align: "center",
        });

      y += 24;
    });

    // ==========================================
    // GROUP TOTAL
    // ==========================================

    y += 10;

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text("GROUP TOTALS");

    doc.moveDown(0.3);

    doc
      .fontSize(8)
      .fillColor("#222")
      .text(`Investment Paid: KSh ${formatMoney(grandInvestment)}`);

    doc.text(`Welfare Paid: KSh ${formatMoney(grandWelfare)}`);

    doc.text(`Total Paid: KSh ${formatMoney(grandPaid)}`);

    doc.text(`Outstanding Balance: KSh ${formatMoney(grandBalance)}`);

    // ==========================================
    // SIGNATURES
    // ==========================================

    doc.moveDown(2);

    doc.text("Prepared By: __________________________", 50);

    doc.text("Treasurer: ____________________________", 300);

    doc.moveDown();

    doc.text("Signature: _____________________________", 50);

    doc.text("Signature: _____________________________", 300);

    doc.moveDown();

    doc
      .fontSize(7)
      .fillColor("#777")
      .text(`Generated: ${new Date().toLocaleString()}`, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("Monthly Contribution PDF Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Failed to generate monthly contribution PDF",
        error: error.message,
      });
    }
  }
};

// ======================================================
// FINE CONTRIBUTION REPORT
// September 2025 - Current Month
// ======================================================

exports.getFineContributionReport = async (req, res) => {
  try {
    // ==================================================
    // REPORT PERIOD
    // ==================================================

    const START_YEAR = 2025;
    const START_MONTH = 8; // September = 8 in JavaScript

    const today = new Date();

    const END_YEAR = today.getFullYear();
    const END_MONTH = today.getMonth();

    const startDate = new Date(START_YEAR, START_MONTH, 1);

    const endDate = new Date(END_YEAR, END_MONTH + 1, 0, 23, 59, 59, 999);

    // ==================================================
    // GENERATE MONTHS
    // ==================================================

    const months = [];

    let year = START_YEAR;
    let month = START_MONTH;

    while (year < END_YEAR || (year === END_YEAR && month <= END_MONTH)) {
      const date = new Date(year, month, 1);

      months.push({
        year,
        month: month + 1,

        key: `${year}-${String(month + 1).padStart(2, "0")}`,

        name: date.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      });

      month++;

      if (month > 11) {
        month = 0;
        year++;
      }
    }

    // ==================================================
    // GET MEMBERS
    // ==================================================

    const members = await User.find()
      .select("memberNumber fullName phoneNumber status")
      .sort({ fullName: 1 });

    // ==================================================
    // GET FINES
    // ==================================================

    const fines = await Fine.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    }).populate("member", "memberNumber fullName phoneNumber");

    // ==================================================
    // GET FINE PAYMENTS
    // ==================================================

    const finePayments = await FinePayment.find({
      paymentDate: {
        $gte: startDate,
        $lte: endDate,
      },
    }).populate("member", "memberNumber fullName phoneNumber");

    // ==================================================
    // ORGANIZE FINES BY MEMBER + MONTH
    // ==================================================

    const fineMap = {};

    fines.forEach((fine) => {
      if (!fine.member) return;

      const date = new Date(fine.createdAt);

      const fineYear = date.getFullYear();

      const fineMonth = date.getMonth() + 1;

      const monthKey = `${fineYear}-${String(fineMonth).padStart(2, "0")}`;

      const memberId = fine.member._id.toString();

      const key = `${memberId}_${monthKey}`;

      if (!fineMap[key]) {
        fineMap[key] = {
          issued: 0,
          paid: 0,
        };
      }

      fineMap[key].issued += Number(fine.amount || 0);
    });

    // ==================================================
    // ORGANIZE FINE PAYMENTS BY MEMBER + MONTH
    // ==================================================

    finePayments.forEach((payment) => {
      if (!payment.member) return;

      const date = new Date(payment.paymentDate);

      const paymentYear = date.getFullYear();

      const paymentMonth = date.getMonth() + 1;

      const monthKey = `${paymentYear}-${String(paymentMonth).padStart(
        2,
        "0",
      )}`;

      const memberId = payment.member._id.toString();

      const key = `${memberId}_${monthKey}`;

      if (!fineMap[key]) {
        fineMap[key] = {
          issued: 0,
          paid: 0,
        };
      }

      fineMap[key].paid += Number(payment.amount || 0);
    });

    // ==================================================
    // CREATE MEMBER REPORT
    // ==================================================

    const memberReports = members.map((member) => {
      let totalIssued = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      const monthly = months.map((monthInfo) => {
        const key = `${member._id}_${monthInfo.key}`;

        const data = fineMap[key] || {
          issued: 0,
          paid: 0,
        };

        const issued = data.issued;

        const paid = data.paid;

        const outstanding = Math.max(issued - paid, 0);

        let status = "NO FINE";

        if (issued > 0 && paid >= issued) {
          status = "PAID";
        } else if (issued > 0 && paid > 0 && paid < issued) {
          status = "PARTIAL";
        } else if (issued > 0 && paid === 0) {
          status = "UNPAID";
        }

        totalIssued += issued;
        totalPaid += paid;
        totalOutstanding += outstanding;

        return {
          month: monthInfo.name,
          monthKey: monthInfo.key,

          fineIssued: issued,
          finePaid: paid,
          outstanding,

          status,
        };
      });

      return {
        member: {
          id: member._id,
          memberNumber: member.memberNumber,
          fullName: member.fullName,
          phoneNumber: member.phoneNumber,
          status: member.status,
        },

        monthly,

        totals: {
          fineIssued: totalIssued,
          finePaid: totalPaid,
          outstanding: totalOutstanding,
        },
      };
    });

    // ==================================================
    // MONTHLY GROUP SUMMARY
    // ==================================================

    const monthlySummary = months.map((monthInfo) => {
      let totalIssued = 0;
      let totalPaid = 0;

      memberReports.forEach((member) => {
        const month = member.monthly.find(
          (item) => item.monthKey === monthInfo.key,
        );

        if (month) {
          totalIssued += month.fineIssued;
          totalPaid += month.finePaid;
        }
      });

      return {
        month: monthInfo.name,
        monthKey: monthInfo.key,

        fineIssued: totalIssued,
        finePaid: totalPaid,

        outstanding: Math.max(totalIssued - totalPaid, 0),
      };
    });

    // ==================================================
    // GRAND TOTALS
    // ==================================================

    const totalFineIssued = memberReports.reduce(
      (total, member) => total + member.totals.fineIssued,
      0,
    );

    const totalFinePaid = memberReports.reduce(
      (total, member) => total + member.totals.finePaid,
      0,
    );

    const totalOutstanding = memberReports.reduce(
      (total, member) => total + member.totals.outstanding,
      0,
    );

    // ==================================================
    // RESPONSE
    // ==================================================

    res.status(200).json({
      message: "Fine contribution report retrieved successfully",

      reportingPeriod: {
        start: "September 2025",

        end: today.toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        }),
      },

      summary: {
        totalMembers: members.length,

        totalFineIssued,

        totalFinePaid,

        totalOutstanding,
      },

      monthlySummary,

      members: memberReports,
    });
  } catch (error) {
    console.error("Fine Contribution Report Error:", error);

    res.status(500).json({
      message: "Failed to retrieve fine contribution report",

      error: error.message,
    });
  }
};

// ======================================================
// FINE CONTRIBUTION PDF
// September 2025 - Current Month
// ======================================================
exports.generateFineContributionPDF = async (req, res) => {
  try {
    const months = getReportMonths();

    const startDate = new Date(REPORT_START_YEAR, REPORT_START_MONTH, 1);

    const endDate = new Date();

    endDate.setHours(23, 59, 59, 999);

    // ==========================================
    // MEMBERS
    // ==========================================

    const members = await User.find({}).sort({ fullName: 1 });

    // ==========================================
    // FINES
    // ==========================================

    const fines = await Fine.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({
      createdAt: 1,
    });

    // ==========================================
    // FINE PAYMENTS
    // ==========================================

    const finePayments = await FinePayment.find({
      paymentDate: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({
      paymentDate: 1,
    });

    // ==========================================
    // GROUP FINES BY MEMBER + MONTH
    // ==========================================

    const fineMap = {};

    fines.forEach((fine) => {
      const memberId = fine.member.toString();

      const date = new Date(fine.createdAt);

      const key = `${memberId}-${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!fineMap[key]) {
        fineMap[key] = 0;
      }

      fineMap[key] += Number(fine.amount || 0);
    });

    // ==========================================
    // GROUP PAYMENTS BY MEMBER
    // ==========================================

    const paymentsByMember = {};

    finePayments.forEach((payment) => {
      const memberId = payment.member.toString();

      if (!paymentsByMember[memberId]) {
        paymentsByMember[memberId] = [];
      }

      paymentsByMember[memberId].push({
        amount: Number(payment.amount || 0),

        paymentDate: payment.paymentDate,
      });
    });

    // ==========================================
    // MEMBER REPORT
    // ==========================================

    const memberReports = [];

    for (const member of members) {
      const memberId = member._id.toString();

      const memberPayments = paymentsByMember[memberId] || [];

      let paymentIndex = 0;

      let paymentRemaining = memberPayments.length
        ? memberPayments[0].amount
        : 0;

      let previousDebt = 0;

      let totalIssued = 0;

      let totalPaid = 0;

      // --------------------------------------
      // MONTHLY DATA
      // --------------------------------------

      const monthlyData = [];

      for (const month of months) {
        const key = `${memberId}-${month.year}-${month.month}`;

        const fineIssued = fineMap[key] || 0;

        totalIssued += fineIssued;

        // Previous outstanding + new fine

        let currentDebt = previousDebt + fineIssued;

        let paidThisMonth = 0;

        // ----------------------------------
        // APPLY FINE PAYMENTS
        // ----------------------------------

        while (currentDebt > 0 && paymentIndex < memberPayments.length) {
          if (paymentRemaining <= 0) {
            paymentIndex++;

            if (paymentIndex < memberPayments.length) {
              paymentRemaining = memberPayments[paymentIndex].amount;
            }

            continue;
          }

          const amount = Math.min(currentDebt, paymentRemaining);

          currentDebt -= amount;

          paymentRemaining -= amount;

          paidThisMonth += amount;

          totalPaid += amount;
        }

        let status = "NO FINE";

        if (fineIssued > 0 || currentDebt > 0) {
          if (currentDebt === 0) {
            status = "PAID";
          } else if (paidThisMonth > 0) {
            status = "PARTIAL";
          } else {
            status = "UNPAID";
          }
        }

        monthlyData.push({
          key: month.key,

          shortName: month.shortName,

          year: month.year,

          fineIssued,

          paid: paidThisMonth,

          balance: currentDebt,

          status,
        });

        previousDebt = currentDebt;
      }

      memberReports.push({
        member,

        monthlyData,

        totalIssued,

        totalPaid,

        totalDebt: previousDebt,
      });
    }

    // ==========================================
    // CREATE PDF
    // ==========================================

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 25,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      "inline; filename=Fine_Contribution_Report.pdf",
    );

    doc.pipe(res);

    // ==========================================
    // HEADER
    // ==========================================

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text("WELFARE & INVESTMENT MANAGEMENT SYSTEM", {
        align: "center",
      });

    doc
      .fontSize(12)
      .fillColor("#222")
      .text("MONTHLY FINE CONTRIBUTION & DEBT REPORT", {
        align: "center",
      });

    doc.moveDown(0.3);

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#555")
      .text(
        `Period: ${months[0].name} ${months[0].year} - ${
          months[months.length - 1].name
        } ${months[months.length - 1].year}`,
        {
          align: "center",
        },
      );

    doc.moveDown();

    // ==========================================
    // GRAND TOTALS
    // ==========================================

    const grandIssued = memberReports.reduce(
      (sum, r) => sum + r.totalIssued,
      0,
    );

    const grandPaid = memberReports.reduce((sum, r) => sum + r.totalPaid, 0);

    const grandDebt = memberReports.reduce((sum, r) => sum + r.totalDebt, 0);

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text(
        `Members: ${members.length}    ` +
          `Fines Issued: KSh ${formatMoney(grandIssued)}    ` +
          `Fine Paid: KSh ${formatMoney(grandPaid)}    ` +
          `Outstanding Debt: KSh ${formatMoney(grandDebt)}`,
      );

    doc.moveDown();

    // ==========================================
    // TABLE
    // ==========================================

    const pageWidth = 842;

    const left = 20;

    const memberWidth = 105;

    const totalWidth = 65;

    const availableWidth = pageWidth - left * 2 - memberWidth - totalWidth;

    const monthWidth = availableWidth / months.length;

    const subWidth = monthWidth / 3;

    let y = doc.y;

    // ==========================================
    // HEADER ROW
    // ==========================================

    doc.rect(left, y, memberWidth, 38).fill("#174A7E");

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("MEMBER", left, y + 14, {
        width: memberWidth,
        align: "center",
      });

    let x = left + memberWidth;

    months.forEach((month) => {
      doc.rect(x, y, monthWidth, 18).fill("#174A7E");

      doc
        .fontSize(6)
        .fillColor("#FFFFFF")
        .text(`${month.shortName} ${month.year}`, x, y + 5, {
          width: monthWidth,
          align: "center",
        });

      doc.rect(x, y + 18, monthWidth, 20).fill("#2C6595");

      doc
        .fontSize(5)
        .fillColor("#FFFFFF")
        .text("FINE", x, y + 25, {
          width: subWidth,
          align: "center",
        });

      doc.text("PAID", x + subWidth, y + 25, {
        width: subWidth,
        align: "center",
      });

      doc.text("BAL", x + subWidth * 2, y + 25, {
        width: subWidth,
        align: "center",
      });

      x += monthWidth;
    });

    // Total debt

    doc.rect(x, y, totalWidth, 38).fill("#174A7E");

    doc
      .fontSize(6)
      .fillColor("#FFFFFF")
      .text("TOTAL\nDEBT", x, y + 10, {
        width: totalWidth,
        align: "center",
      });

    y += 38;

    // ==========================================
    // MEMBER ROWS
    // ==========================================

    memberReports.forEach((report) => {
      if (y > 560) {
        doc.addPage();

        y = 35;

        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#174A7E")
          .text("MONTHLY FINE CONTRIBUTION REPORT");

        y = doc.y + 10;
      }

      doc.rect(left, y, memberWidth, 24).stroke("#CCCCCC");

      doc
        .fontSize(6)
        .font("Helvetica-Bold")
        .fillColor("#222")
        .text(
          report.member.fullName || report.member.name || "Unknown Member",
          left + 3,
          y + 8,
          {
            width: memberWidth - 6,
          },
        );

      let cellX = left + memberWidth;

      report.monthlyData.forEach((data) => {
        // Fine

        doc.rect(cellX, y, subWidth, 24).stroke("#CCCCCC");

        doc
          .fontSize(5.5)
          .font("Helvetica")
          .text(formatMoney(data.fineIssued), cellX, y + 8, {
            width: subWidth,
            align: "center",
          });

        // Paid

        doc.rect(cellX + subWidth, y, subWidth, 24).stroke("#CCCCCC");

        doc.text(formatMoney(data.paid), cellX + subWidth, y + 8, {
          width: subWidth,
          align: "center",
        });

        // Balance

        doc.rect(cellX + subWidth * 2, y, subWidth, 24).stroke("#CCCCCC");

        doc.text(formatMoney(data.balance), cellX + subWidth * 2, y + 8, {
          width: subWidth,
          align: "center",
        });

        cellX += monthWidth;
      });

      // Total debt

      doc.rect(cellX, y, totalWidth, 24).stroke("#CCCCCC");

      doc
        .fontSize(6)
        .font("Helvetica-Bold")
        .text(formatMoney(report.totalDebt), cellX, y + 8, {
          width: totalWidth,
          align: "center",
        });

      y += 24;
    });

    // ==========================================
    // SUMMARY
    // ==========================================

    y += 10;

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#174A7E")
      .text("FINE SUMMARY");

    doc.moveDown(0.3);

    doc
      .fontSize(8)
      .fillColor("#222")
      .text(`Total Fines Issued: KSh ${formatMoney(grandIssued)}`);

    doc.text(`Total Fine Payments: KSh ${formatMoney(grandPaid)}`);

    doc.text(`Total Outstanding Fine Debt: KSh ${formatMoney(grandDebt)}`);

    // ==========================================
    // SIGNATURES
    // ==========================================

    doc.moveDown(2);

    doc.text("Prepared By: __________________________", 50);

    doc.text("Treasurer: ____________________________", 300);

    doc.moveDown();

    doc.text("Signature: _____________________________", 50);

    doc.text("Signature: _____________________________", 300);

    doc.moveDown();

    doc
      .fontSize(7)
      .fillColor("#777")
      .text(`Generated: ${new Date().toLocaleString()}`, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("Fine Contribution PDF Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        message: "Failed to generate fine contribution PDF",
        error: error.message,
      });
    }
  }
};

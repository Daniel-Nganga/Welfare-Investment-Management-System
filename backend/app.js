require("dotenv").config();
const express = require("express");

const app = express();

const PORT = process.env.PORT || 5000;
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const memberRoutes = require("./routes/memberRoutes");
const investmentWelfareRoutes = require("./routes/investmentWelfarePaymentRoutes");
const fineRoutes = require("./routes/fineRoutes");
const finePaymentRoutes = require("./routes/finePaymentRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const reportRoutes = require("./routes/reportRoutes");
const systemConfigRoutes = require("./routes/systemConfigRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Member routes

app.use("/api/member", memberRoutes);
app.use("/api/saving", investmentWelfareRoutes);
app.use("/api/fines", fineRoutes);
app.use("/api/fine-payments", finePaymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);

app.use("/api/system-config", systemConfigRoutes);

app.use("/api/notifications", notificationRoutes);
// Connect to DB then start server

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

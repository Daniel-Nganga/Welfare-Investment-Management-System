# Welfare & Investment Management System

A full-stack member management system for tracking welfare contributions, investment contributions, fines, expenses, reports, and member notifications in a group or cooperative setting.

This project combines a Node.js/Express backend with a static frontend built using HTML, CSS, and JavaScript. The backend serves the frontend and exposes REST APIs for secure member, payment, reporting, and system configuration management.

## Overview

The system is designed for organizations that need to manage member financial records and related operations. It supports:

- Member registration and login
- Investment and welfare contribution tracking
- Fine management and fine payment records
- Expense tracking and fund balance monitoring
- Administrative reporting and financial summaries
- PDF report generation for contributions and financial activity
- Notifications for members and administrators
- Role-based access for members and admins

## Features

### Member management
- Member registration with unique member number and phone validation
- Member login with JWT-based authentication
- Profile retrieval and member listing
- Password update for authenticated users
- Profile picture upload support through Cloudinary

### Financial management
- Add, view, update, and delete investment/welfare payments
- View member-specific payment history
- Track contributions by member and by fund type
- Record and manage fines
- Record fine payments and retrieve payment history
- Add, update, and review expenses
- Monitor fund balances and financial summaries

### Reporting and PDFs
- Dashboard metrics for members, total contributions, welfare, fines, expenses, and balance
- Full reporting endpoints for payments, fines, and expenses
- Financial summary generation
- PDF reports for:
  - financial statements
  - monthly contribution summaries
  - fine contribution summaries

### Administrative controls
- Admin-only routes for financial and system updates
- System configuration endpoints
- Notification management for mark-as-read and deletion

### Frontend
The frontend is served directly from the backend and includes pages such as:
- Dashboard
- Members
- Contributions
- Welfare
- Fines
- Expenses
- Transactions
- Reports
- PDF Reports
- Settings
- Login

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Cloudinary for profile image upload
- PDFKit for PDF generation
- CORS and cookie-parser middleware

### Frontend
- HTML
- CSS
- JavaScript
- Static pages served by Express

## Project Structure

```text
Welfare & Investment Management System/
├── backend/
│   ├── app.js
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── config/
│   │   ├── cloudinary.js
│   │   └── db.js
│   ├── Controllers/
│   │   ├── expenseController.js
│   │   ├── finePaymentController.js
│   │   ├── finesController.js
│   │   ├── investmentWelfarePaymentController.js
│   │   ├── memberController.js
│   │   ├── notificationController.js
│   │   ├── pdfReportController.js
│   │   ├── reportController.js
│   │   └── systemConfigController.js
│   ├── middleware/
│   │   ├── adminMiddleware.js
│   │   ├── cloudinaryMiddleware.js
│   │   └── paymentProtectionMiddleware.js
│   ├── models/
│   │   ├── ExpenseModel.js
│   │   ├── FineModel.js
│   │   ├── finePaymentModel.js
│   │   ├── InvestmentWelfarepaymentModel.js
│   │   ├── notificationModel.js
│   │   ├── systemConfigModel.js
│   │   └── userModel.js
│   ├── routes/
│   │   ├── expenseRoutes.js
│   │   ├── finePaymentRoutes.js
│   │   ├── fineRoutes.js
│   │   ├── investmentWelfarePaymentRoutes.js
│   │   ├── memberRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── reportRoutes.js
│   │   └── systemConfigRoutes.js
│   └── services/
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── members.html
│   ├── contributions.html
│   ├── welfare.html
│   ├── fines.html
│   ├── expenses.html
│   ├── transactions.html
│   ├── reports.html
│   ├── pdf-reports.html
│   ├── settings.html
│   ├── attendance.html
│   ├── login.js
│   ├── dashboard.js
│   ├── members.js
│   ├── contributions.js
│   ├── welfare.js
│   ├── notifications.js
│   ├── settings.js
│   ├── fine.js
│   ├── style.css
│   ├── stylelogin.css
│   └── ...
├── README.md
└── .gitignore
```

## Prerequisites

Before running the project, ensure you have the following installed:

- Node.js (v18 or later recommended)
- npm
- MongoDB running locally or accessible via a MongoDB URI
- Cloudinary account for profile image uploads

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd "Welfare & Investment Management System"
```

2. Navigate to the backend folder:

```bash
cd backend
```

3. Install dependencies:

```bash
npm install
```

## Environment Configuration

Create a `.env` file inside the `backend` folder with the following variables:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/welfare_management
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> Make sure MongoDB is running before starting the server. Replace the placeholder values with your actual credentials.

## Running the Application

From the `backend` directory:

```bash
node app.js
```

For development with auto-restart:

```bash
npx nodemon app.js
```

The backend serves the frontend static files automatically, so after the server starts, open:

```text
http://localhost:5000
```

## Default API Behavior

The app exposes REST APIs under the following routes:

- `/api/member` - member registration, login, profile access, password updates
- `/api/saving` - investment/welfare payment management
- `/api/fines` - fine creation and retrieval
- `/api/fine-payments` - fine payment tracking and history
- `/api/expenses` - expense management and fund balances
- `/api/reports` - dashboard and financial reports
- `/api/system-config` - application settings configuration
- `/api/notifications` - notifications and read state management

Most routes require a valid JWT in the `Authorization` header using the format:

```http
Authorization: Bearer <token>
```

Admin-only endpoints are protected by an admin check in the middleware.

## User Roles

### Admin
- Manage members
- Record fines and expenses
- Review payments and contributions
- View financial reports and PDF exports
- Update system configuration

### Member
- Register and log in
- View their own contributions and fines
- Update password
- Access protected member-specific financial information

## Notes

- The project currently serves the frontend from the backend using Express static hosting.
- The app is designed for local development and may require additional configuration for production deployment.
- If deployed publicly, configure secure environment variables and a proper production-grade MongoDB setup.

## License

This project is currently licensed under the ISC license as specified in the backend package configuration.

## Contact

This project does not currently include a public maintainer or team contact section in the repository files. Update this section if needed for your production environment.

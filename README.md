# 🧀 JanCheese Local Backend

This repository contains the lightweight, production-ready local backend server developed as part of a custom full-stack e-commerce solution for a local artisanal gastronomy business, **JanCheese**. 

The primary objective of this project was to transition a traditional business into the digital space by building a seamless, responsive ordering platform. This specific backend handles secure payload validation, CORS management for local/client-side environments, and asynchronous order notifications without blocking the user interface.

## 💼 Business Logic & Engineering Value

When designing this system, the focus was split between **user experience (UX)** and **backend resilience**:
* **Decoupled Architecture:** Built with a Headless/Separated frontend-backend mindset, allowing the client-side UI to remain incredibly fast and hostable on static platforms like GitHub Pages.
* **Non-Blocking Asynchronous Operations:** To prevent the frontend from freezing or timing out during network-heavy operations, the server delivers an immediate `200 OK` success response to the client as soon as data validation passes. The SMTP email dispatch runs concurrently in the background.
* **Data Integrity:** Implemented strict request filtering to ensure no malformed or incomplete orders hit the administration logs.

## 🛠️ Technical Stack & Competencies Demonstrated

* **Runtime Environment:** Node.js
* **Backend Framework:** Express.js
* **Security & Traffic Control:** CORS (configured for cross-origin local testing), Express-Rate-Limit (protection against brute-force spamming).
* **Data Validation:** Express-Validator (ensuring data sanitization and type-safety for customer inputs).
* **Notification Layer:** Nodemailer with Gmail SMTP integration.
* **Environment Management:** Dotenv (strict separation of code and sensitive configuration secrets).

## 🚀 Local Deployment & Quick Start

To audit or run this project locally on your machine, follow these steps:

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v16+ recommended).

### 2. Clone and Install Dependencies
Navigate to the project root directory in your terminal and execute:
npm install
```bash
npm start

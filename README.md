# Warehouse Dispatch Management System

<p align="center">
  <strong>Enterprise Offline-First Logistics & Dispatch Operations Software</strong><br>
  Developed by <strong>Stivate</strong> for <strong>I3PL India Pvt Ltd</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-v35.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-v19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-v5.7.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Better--SQLite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Vite-v8.1.0-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

---

## 📌 Executive Overview


The **Warehouse Dispatch Management System** is a mission-critical desktop application designed for high-throughput warehouse and logistics environments. It streamlines vehicle dispatching, barcode scanning, pull-list verification, delivery challan generation, and departure reporting.

Engineered with an **Offline-First Architecture**, the application guarantees uninterrupted warehouse operations even during network outages, while seamlessly synchronizing encrypted database backups to AWS S3 Cloud when internet connectivity is available.

---

## ✨ Key Features

### 🚛 1. Real-Time Dispatch Pipeline
- **Kanban & Table Views:** Monitor active dispatches across multi-stage pipelines (*Draft*, *Loading*, *Verified*, *Completed*).
- **Departure Tracking:** Captures exact vehicle departure timestamps upon loading completion.
- **Truck & Vehicle Management:** Pre-loads vehicle capacities (e.g. 32FT, 20FT, 14FT), driver numbers, supervisor names, and consignee addresses.

### 📦 2. Barcode & Pull-List Scanning Engine
- **Instant Scan Verification:** Multi-format barcode scanner support for incoming pull lists and kit codes.
- **Workcell & Kit Grouping:** Dynamically categorizes scanned items into designated workcells (e.g., *NCR*, *SCHNEIDER*, *PHON*, *TESLA*, *MELLANOX*, *WHIRLPOOL*, *ERICSSON*).
- **Pallet Allocation:** Automatically calculates total pallet counts per workcell and per departure round.

### 🖨️ 3. High-Clarity Printing System
- **A4 Landscape Delivery Challan:** Renders crisp, professional 3-copy landscape Delivery Challan invoices.
- **Barcode Sheet Printing:** Generates high-density barcode sheets optimized for thermal and desktop printers.
- **Combined Printing:** 1-Click printing workflow (<kbd>Ctrl+P</kbd>) that outputs both Challans and Barcodes simultaneously.

### 📊 4. Dynamic Reports & Excel Exporter
- **Custom Loading Summaries:** Generates formatted destination-wise loading reports matching strict customer Excel templates (e.g., *Jabil*, *Schneider*).
- **Excel (.xls) Styling Engine:** Exports sheets with custom headers, yellow title banners, round indicators (`ROUND 1/0`), and clean time logs.
- **Multi-Dimensional Analytics:** Aggregate dispatches by *Daily*, *Monthly*, *Vehicle Number*, or *Supervisor*.

### ☁️ 5. Dual Backup & Cloud Protection
- **Local SQLite Backups:** Instant local database snapshots saved to user-configurable storage paths.
- **AWS S3 Cloud Backups:** Background automated database uploads to AWS S3 buckets to prevent hardware data loss.

### 🔄 6. Auto-Updater Integration
- Integrated with GitHub Releases via `electron-updater` for seamless 1-click updates without manual installer downloads.

---

## ⌨️ Native Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Open New Dispatch Popup | Global / Pipeline / Loading |
| <kbd>Ctrl</kbd> + <kbd>H</kbd> | Navigate to Completed Archive | Global |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Print Combined Dispatch (3 copies) | Loading & Verified Views |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Save Draft Dispatch | Dispatch Form |
| <kbd>Esc</kbd> | Close Active Modal / Popup | Global Modals |

---

## 🏗️ System Architecture

```
                                  +---------------------------------------+
                                  |         React 19 Frontend UI          |
                                  |   (Tailwind CSS + Lucide + Vite)      |
                                  +------------------+--------------------+
                                                     |
                                            IPC Context Bridge
                                                     |
                                  +------------------v--------------------+
                                  |       Electron 35 Main Process        |
                                  |          (Node.js Runtime)            |
                                  +--------+------------------+-----------+
                                           |                  |
                    +----------------------+                  +-----------------------+
                    |                                                                 |
         +----------v----------+                                           +----------v----------+
         |   Better-SQLite3    |                                           |     AWS S3 SDK      |
         |   Local Database    |                                           |   Cloud Backup      |
         +---------------------+                                           +---------------------+
```

---

## 🛠️ Tech Stack & Dependencies

- **Desktop Framework:** [Electron 35](https://www.electronjs.org/)
- **Frontend Library:** [React 19](https://react.dev/)
- **Programming Language:** [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)
- **Database Engine:** [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- **PDF Generation:** [PDFKit](https://pdfkit.org/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Distribution & Auto-Updates:** `electron-builder` & `electron-updater`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **C++ Build Tools**: Required for compiling native modules (`better-sqlite3`).

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/itxadii/stivate-invoice-system-i3pl.git
cd invoice-system
npm install
```

### 2. Running Development Mode

Launch Vite dev server and Electron simultaneously with HMR (Hot Module Replacement):

```bash
npm run electron:dev
```

### 3. Production Packaging

To compile TypeScript, bundle web assets, and package the Windows installer executable (`.exe`):

```bash
# Step 1: Compile web assets & main process
npm run build
npm run electron:build-main

# Step 2: Build installer package
npm run electron:build
```

The output installer files (`.exe`, `latest.yml`, `.blockmap`) will be generated inside the `dist/` directory.

### 4. Publishing Releases (Auto-Updater)

To push a new version release directly to GitHub Releases for automatic client updates:

```powershell
# Set GitHub Access Token (PowerShell)
$env:GH_TOKEN="your_github_access_token"

# Build & Publish Release
npm run build
npm run electron:build-main
npx electron-builder --publish always
```

---

## 📄 Compliance & Governance Policies

- **Privacy Policy:** Refer to [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for offline data handling, cloud backup, and retention details.
- **Security Policy:** Refer to [SECURITY_POLICY.md](SECURITY_POLICY.md) for system architecture security, database protection, and incident response procedures.

---

## 🏢 Owner & License Information

- **Provider:** **Stivate** (https://stivate.com)
- **License:** Proprietary - All rights reserved. Authorized commercial deployment only.

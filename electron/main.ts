import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadSettings, saveSettings } from './ipc/settings';
import {
  saveDispatch,
  deleteDispatch,
  getDispatch,
  getAllDispatches,
  searchDispatches,
  searchPullList,
  importMasterData,
  getDashboardStats,
  getReportsData,
  getTrendData,
  getDb
} from './ipc/database';
import { backupDatabase, uploadBackupToCloud } from './ipc/backup';
import { printChallan, printBarcodes, printCombinedDispatch } from './ipc/printer';
import { checkForUpdates, downloadUpdate, installUpdate, getUpdateInfo } from './updater';

let mainWindow: BrowserWindow | null = null;
// Database indexing initialized

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'I3PL Dispatch Invoice System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load React app
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open devtools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Trigger auto local and cloud backup on close
  let isBackingUpAndQuitting = false;
  mainWindow.on('close', (e) => {
    if (isBackingUpAndQuitting) return;

    // Prevent default exit
    e.preventDefault();
    isBackingUpAndQuitting = true;
    
    console.log('App closing: Triggering automatic local and cloud S3 backup...');
    
    // Hide window immediately for responsive closure UX
    if (mainWindow) {
      mainWindow.hide();
    }

    // Run async backup & cloud upload
    (async () => {
      try {
        const localRes = backupDatabase();
        console.log('Auto local backup on exit result:', localRes.message);

        const cloudRes = await uploadBackupToCloud();
        console.log('Auto cloud backup on exit result:', cloudRes.message);
      } catch (err) {
        console.error('Auto backup on close failed:', err);
      } finally {
        if (mainWindow) {
          mainWindow.destroy();
        }
      }
    })();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize Database once on startup to verify setup
  try {
    const db = getDb();
    console.log('SQLite database initialized successfully.');

    // Check for seed flag to seed 1L records
    const seedFlagPath = path.join(process.cwd(), 'run_seed.flag');
    if (fs.existsSync(seedFlagPath)) {
      console.log('Seeding flag found. Generating test database records (300k+ rows)...');
      
      // Seed master pull lists (1,000,000 records / 10 Lakhs)
      const insertMaster = db.prepare(`
        INSERT OR REPLACE INTO pull_list_master (pull_list_no, id_number, kit_type, workcell, parts, barcode)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertDispatch = db.prepare(`
        INSERT OR REPLACE INTO dispatches (dc_no, date, vehicle_no, supplier_name, address, total_pallets, total_parts, created_by, particular)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertDispatchItem = db.prepare(`
        INSERT OR REPLACE INTO dispatch_items (dispatch_id, pull_list_no, id_number, kit_type, workcell, parts)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // 1. Insert 10 Lakhs pull list master items
      db.transaction(() => {
        for (let i = 1; i <= 1000000; i++) {
          const pullListNo = `PL-${String(i).padStart(7, '0')}`;
          const idNo = `ID-${String(Math.floor(i / 10) + 1).padStart(7, '0')}`;
          const kitType = `KIT-${['A', 'B', 'C', 'D'][i % 4]}`;
          const workcell = `CELL-${['X', 'Y', 'Z', 'W'][i % 4]}`;
          const parts = (i % 50) + 1;
          insertMaster.run(pullListNo, idNo, kitType, workcell, parts, pullListNo);
        }
      })();
      console.log('Successfully seeded 10 Lakhs pull list master records.');

      // 2. Insert 100,000 dispatches with 10 items each (1,000,000 items total)
      db.transaction(() => {
        const startDate = new Date();
        for (let d = 1; d <= 100000; d++) {
          const dateOffset = Math.floor(d / 1000); // spread across 100 days
          const date = new Date(startDate.getTime() - dateOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const dcNo = `DC-${date.replace(/-/g, '')}-${String(d).padStart(6, '0')}`;
          const vehicleNo = `MH-12-QW-${String(1000 + (d % 9000))}`;
          const supplierName = ['MAHADEV', 'I3PL', 'SUPERVISOR_A', 'SUPERVISOR_B'][d % 4];
          const address = 'JABIL CURCUIT INDIA PVT LTD (EHTP UNIT)\nPLOT NO-B-26, Ranjangaon MIDC';
          const totalPallets = (d % 5) + 1;
          const totalParts = 500;
          
          const res = insertDispatch.run(dcNo, date, vehicleNo, supplierName, address, totalPallets, totalParts, 'Operator', 'AS PER LIST');
          const dispatchId = res.lastInsertRowid;
          
          for (let itemIdx = 1; itemIdx <= 10; itemIdx++) {
            const plIndex = ((d * 10 + itemIdx) % 1000000) + 1;
            const pullListNo = `PL-${String(plIndex).padStart(7, '0')}`;
            const idNo = `ID-${String(Math.floor(plIndex / 10) + 1).padStart(7, '0')}`;
            const kitType = `KIT-${['A', 'B', 'C', 'D'][plIndex % 4]}`;
            const workcell = `CELL-${['X', 'Y', 'Z', 'W'][plIndex % 4]}`;
            const parts = (plIndex % 50) + 1;
            insertDispatchItem.run(dispatchId, pullListNo, idNo, kitType, workcell, parts);
          }
        }
      })();
      console.log('Successfully seeded 100,000 dispatches & 1,000,000 dispatch items!');

      try {
        fs.unlinkSync(seedFlagPath);
        console.log('Database seeding complete. Flag file removed.');
      } catch (e) {
        console.error('Failed to delete seed flag:', e);
      }
    }
  } catch (err) {
    console.error('Failed to initialize database or run seed on startup:', err);
  }

  // Register IPC handlers
  ipcMain.handle('settings:load', () => {
    return loadSettings();
  });

  ipcMain.handle('settings:save', (_, settings) => {
    return saveSettings(settings);
  });

  ipcMain.handle('db:saveDispatch', (_, dispatch, items) => {
    return saveDispatch(dispatch, items);
  });

  ipcMain.handle('db:deleteDispatch', (_, id) => {
    return deleteDispatch(id);
  });

  ipcMain.handle('db:getDispatch', (_, id) => {
    return getDispatch(id);
  });

  ipcMain.handle('db:getAllDispatches', (_, limit, offset) => {
    return getAllDispatches(limit, offset);
  });

  ipcMain.handle('db:searchDispatches', (_, query, limit, offset) => {
    return searchDispatches(query, limit, offset);
  });

  ipcMain.handle('db:searchPullList', (_, pullListNo) => {
    return searchPullList(pullListNo);
  });

  ipcMain.handle('db:importMasterData', (_, rows) => {
    return importMasterData(rows);
  });

  ipcMain.handle('db:getDashboardStats', () => {
    return getDashboardStats();
  });

  ipcMain.handle('db:getTrendData', (_, range) => {
    return getTrendData(range);
  });

  ipcMain.handle('db:getReports', (_, type, startDate, endDate) => {
    return getReportsData(type, startDate, endDate);
  });

  ipcMain.handle('backup:trigger', () => {
    return backupDatabase();
  });

  ipcMain.handle('backup:uploadCloud', () => {
    return uploadBackupToCloud();
  });

  ipcMain.handle('print:challan', (_, dispatch, items) => {
    return printChallan(dispatch, items);
  });

  ipcMain.handle('print:barcodes', (_, items) => {
    return printBarcodes(items);
  });

  ipcMain.handle('print:combined', (_, dispatch, items) => {
    return printCombinedDispatch(dispatch, items);
  });

  // Updater IPC handlers
  ipcMain.handle('updater:check', () => {
    return checkForUpdates();
  });

  ipcMain.handle('updater:download', () => {
    return downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    return installUpdate();
  });

  ipcMain.handle('updater:getVersion', () => {
    return getUpdateInfo();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

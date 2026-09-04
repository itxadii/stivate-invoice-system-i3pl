import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface AppSettings {
  companyName: string;
  address: string;
  printer: string;
  barcodePrinter: string;

  databaseLocation: string;
  backupFolder: string;
  printsFolder: string;
  logsFolder: string;

  addressesList: string[];
  suppliersList: string[];
  scannersList: string[];
  verifiersList: string[];
  vehiclesList: string[];
  vehicleSizesList?: string[];

  defaultAddress: string;
  defaultSupplier: string;
  defaultScanner: string;
  defaultVerifier: string;
  defaultVehicleNo: string;
  defaultVehicleSize?: string;
  warehouseLocation?: string;
  lastCloudBackupTime?: number;
  lastHourlyCloudBackupTime?: number;
}

/**
 * Returns the root directory where all application data is stored.
 *
 * Development:
 * invoice-system/dev-data/
 *
 * Production:
 * C:\ProgramData\Invoice System\
 */
export const getBaseDirectory = (): string => {
  const isDev = !app.isPackaged;

  return isDev
    ? path.join(process.cwd(), 'dev-data')
    : app.getPath('userData');
};

/**
 * Create required folders automatically.
 */
const ensureDirectories = () => {
  const baseDir = getBaseDirectory();

  const folders = [
    baseDir,
    path.join(baseDir, 'database'),
    path.join(baseDir, 'backups'),
    path.join(baseDir, 'settings'),
    path.join(baseDir, 'prints'),
    path.join(baseDir, 'logs'),
  ];

  folders.forEach((folder) => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });
};

/**
 * Location of settings.json
 */
const getSettingsPath = (): string => {
  ensureDirectories();
  return path.join(getBaseDirectory(), 'settings', 'settings.json');
};

export const getDefaultSettings = (): AppSettings => {
  ensureDirectories();

  const baseDir = getBaseDirectory();

  const defaultAddress =
    'JABIL CURCUIT INDIA PVT LTD (EHTP UNIT)\n' +
    'PLOT NO-B-26, Ranjangaon MIDC\n' +
    'Tal- Shirur, Dist- Pune 412209';

  return {
    companyName: 'I3PL INDIA PVT LTD',

    address:
      'Gat No. 1462/63, Dhoksangavi, Tal-Shirur, Dist-Pune, Maharashtra-412209\n' +
      'Contact Number : +918625866581\n' +
      'E-mail : kitpulling.b-warehouse@i3plindia.com',

    printer: 'Default',

    barcodePrinter: 'Default',

    databaseLocation: path.join(baseDir, 'database', 'warehouse.db'),

    backupFolder: path.join(baseDir, 'backups'),

    printsFolder: path.join(baseDir, 'prints'),

    logsFolder: path.join(baseDir, 'logs'),

    addressesList: [
      defaultAddress,
      'JABIL PLANT',
      'AS PER LIST',
    ],

    suppliersList: [
      'MAHADEV',
      'I3PL',
    ],

    scannersList: [
      'PRASAD',
      'AMOL',
      'SHUBHAM',
    ],

    verifiersList: [
      'AMOL',
      'PRASAD',
      'SHUBHAM',
    ],

    vehiclesList: [
      'MH-12-QW-1234',
      'MH-14-ER-5678',
    ],

    vehicleSizesList: [
      '32 ft',
      '20 ft',
      '10 ft',
    ],

    defaultAddress,

    defaultSupplier: 'MAHADEV',

    defaultScanner: 'PRASAD',

    defaultVerifier: 'AMOL',

    defaultVehicleNo: '',

    defaultVehicleSize: '32 ft',

    warehouseLocation: 'F W H',
  };
};

export const loadSettings = (): AppSettings => {
  try {
    ensureDirectories();

    const settingsFile = getSettingsPath();

    if (fs.existsSync(settingsFile)) {
      const saved = JSON.parse(
        fs.readFileSync(settingsFile, 'utf8')
      );

      return {
        ...getDefaultSettings(),
        ...saved,
      };
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  return getDefaultSettings();
};

export const saveSettings = (
  settings: AppSettings
): boolean => {
  try {
    ensureDirectories();

    // Override file system paths to always use app data directory for security
    const baseDir = getBaseDirectory();
    const secureSettings = {
      ...settings,
      databaseLocation: path.join(baseDir, 'database', 'warehouse.db'),
      backupFolder: path.join(baseDir, 'backups'),
      printsFolder: path.join(baseDir, 'prints'),
      logsFolder: path.join(baseDir, 'logs'),
    };

    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(secureSettings, null, 2),
      'utf8'
    );

    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
};
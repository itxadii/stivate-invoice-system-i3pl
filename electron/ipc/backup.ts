import * as fs from 'fs';
import * as path from 'path';
import { loadSettings, saveSettings } from './settings';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const S3_CREDENTIALS = {
  accessKeyId: 'AKIATXMECZM3MDCYHAUY',
  secretAccessKey: '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'
};
const S3_BUCKET = 'dispatch-backup-i3pl';
const PRIMARY_REGION = 'ap-south-1';
const FALLBACK_REGION = 'us-east-1';

const getWarehouseFolderName = (settings: any): string => {
  const raw = (settings?.warehouseLocation || 'F_W_H').trim();
  const safeName = raw.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
  return safeName || 'F_W_H';
};

/**
 * Flush SQLite WAL frames to ensure active records are committed to main db file.
 */
const flushWalCheckpoint = () => {
  try {
    const { getDb } = require('./database');
    const db = getDb();
    if (db && typeof db.pragma === 'function') {
      db.pragma('wal_checkpoint(PASSIVE)');
    }
  } catch {
    // Non-critical; proceed with backup
  }
};

/**
 * Execute S3 command on primary region with automatic fallback to secondary region.
 */
const executeS3Command = async <T>(commandFactory: () => any): Promise<T> => {
  try {
    const s3Client = new S3Client({
      region: PRIMARY_REGION,
      credentials: S3_CREDENTIALS
    });
    return await s3Client.send(commandFactory()) as T;
  } catch (primaryErr) {
    console.warn(`S3 command failed in ${PRIMARY_REGION}, trying fallback ${FALLBACK_REGION}:`, primaryErr);
    const fallbackClient = new S3Client({
      region: FALLBACK_REGION,
      credentials: S3_CREDENTIALS
    });
    return await fallbackClient.send(commandFactory()) as T;
  }
};

const updateLastArchiveBackupTime = () => {
  try {
    const currentSettings = loadSettings();
    const now = Date.now();
    saveSettings({
      ...currentSettings,
      lastCloudBackupTime: now,
      lastHourlyCloudBackupTime: now,
    });
  } catch (err) {
    console.error('Failed to record lastCloudBackupTime:', err);
  }
};

const updateLastHourlyBackupTime = () => {
  try {
    const currentSettings = loadSettings();
    saveSettings({
      ...currentSettings,
      lastHourlyCloudBackupTime: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record lastHourlyCloudBackupTime:', err);
  }
};

/**
 * Create a local timestamped backup in the warehouse backup directory,
 * keeping the latest 30 snapshots, plus a local latest.db copy.
 */
export const backupDatabase = (): { success: boolean; message: string } => {
  try {
    flushWalCheckpoint();

    const settings = loadSettings();
    const dbPath = settings.databaseLocation;
    const baseBackupDir = settings.backupFolder;
    const warehouseFolder = getWarehouseFolderName(settings);
    const backupDir = path.join(baseBackupDir, warehouseFolder);

    if (!fs.existsSync(dbPath)) {
      return { success: false, message: 'Database file not found.' };
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const Min = String(now.getMinutes()).padStart(2, '0');
    const Sec = String(now.getSeconds()).padStart(2, '0');

    const filename = `backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;
    const destPath = path.join(backupDir, filename);

    // Copy to timestamped archive
    fs.copyFileSync(dbPath, destPath);

    // Also update local latest.db
    const localLatestPath = path.join(backupDir, 'latest.db');
    fs.copyFileSync(dbPath, localLatestPath);

    // Prune backups (keep latest 30 timestamped backups)
    pruneBackups(backupDir);

    updateLastArchiveBackupTime();

    return { success: true, message: `Local backup saved in ${warehouseFolder}: ${filename}` };
  } catch (err: any) {
    console.error('Backup failed:', err);
    return { success: false, message: err.message || 'Backup process failed' };
  }
};

const pruneBackups = (backupDir: string) => {
  try {
    if (!fs.existsSync(backupDir)) return;

    const files = fs.readdirSync(backupDir);
    const backupFiles = files
      .filter((file) => file.startsWith('backup_') && file.endsWith('.db'))
      .map((file) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: filePath, mtime: stats.mtimeMs };
      });

    // Sort by modification time descending (newest first)
    backupFiles.sort((a, b) => b.mtime - a.mtime);

    // Keep only the first 30 snapshots
    if (backupFiles.length > 30) {
      const filesToDelete = backupFiles.slice(30);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Pruned old backup snapshot: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('Failed to prune old backups:', err);
  }
};

/**
 * Hourly Live State Backup:
 * Overwrites S3 key `backups/{WAREHOUSE}/latest.db` using PutObject.
 * Incurs zero additional cloud storage cost because only 1 single file (~2-5 MB)
 * is maintained on S3. Does not require s3:DeleteObject permission.
 */
export const uploadLiveStateBackup = async (): Promise<{ success: boolean; message: string }> => {
  try {
    flushWalCheckpoint();

    const settings = loadSettings();
    const dbPath = settings.databaseLocation;
    const warehouseFolder = getWarehouseFolderName(settings);

    if (!fs.existsSync(dbPath)) {
      return { success: false, message: 'Database file not found.' };
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const s3Key = `backups/${warehouseFolder}/latest.db`;

    await executeS3Command(() => new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer
    }));

    // Update local latest.db as well if backup directory exists
    const baseBackupDir = settings.backupFolder;
    const backupDir = path.join(baseBackupDir, warehouseFolder);
    if (fs.existsSync(backupDir)) {
      fs.copyFileSync(dbPath, path.join(backupDir, 'latest.db'));
    }

    updateLastHourlyBackupTime();
    console.log(`[Hourly Live State] Successfully overwritten ${s3Key} on S3.`);
    return {
      success: true,
      message: `Hourly live state backup (${warehouseFolder}/latest.db) uploaded to cloud successfully.`
    };
  } catch (err: any) {
    console.error('[Hourly Live State] Upload failed:', err);
    return { success: false, message: `Hourly live backup failed: ${err.message || err}` };
  }
};

/**
 * 3-Day Archive Backup:
 * Uploads a timestamped snapshot `backup_YYYY_MM_DD_...db` to S3,
 * and also refreshes `latest.db` so both historical snapshots and the live state are updated.
 */
export const uploadBackupToCloud = async (): Promise<{ success: boolean; message: string }> => {
  try {
    flushWalCheckpoint();

    const settings = loadSettings();
    const dbPath = settings.databaseLocation;
    const warehouseFolder = getWarehouseFolderName(settings);

    if (!fs.existsSync(dbPath)) {
      return { success: false, message: 'Database file not found.' };
    }

    const fileBuffer = fs.readFileSync(dbPath);

    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const Min = String(now.getMinutes()).padStart(2, '0');
    const Sec = String(now.getSeconds()).padStart(2, '0');
    const archiveKey = `backups/${warehouseFolder}/backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;
    const liveKey = `backups/${warehouseFolder}/latest.db`;

    // 1. Upload timestamped historical archive
    await executeS3Command(() => new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: archiveKey,
      Body: fileBuffer
    }));

    // 2. Overwrite latest.db with the current state
    await executeS3Command(() => new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: liveKey,
      Body: fileBuffer
    }));

    updateLastArchiveBackupTime();

    return {
      success: true,
      message: `Cloud archive uploaded (${archiveKey}) & live state updated (${liveKey}) successfully.`
    };
  } catch (err: any) {
    console.error('Cloud archive upload failed:', err);
    return { success: false, message: `Cloud archive upload failed: ${err.message || err}` };
  }
};

/**
 * Restore database from the cloud live state `backups/{WAREHOUSE}/latest.db`.
 * Ideal for hardware replacement or disaster recovery up to the last hour.
 */
export const restoreFromCloudLatest = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const settings = loadSettings();
    const dbPath = settings.databaseLocation;
    const warehouseFolder = getWarehouseFolderName(settings);
    const s3Key = `backups/${warehouseFolder}/latest.db`;

    console.log(`[Cloud Restore] Fetching ${s3Key} from bucket ${S3_BUCKET}...`);
    const response = await executeS3Command<any>(() => new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    }));

    if (!response || !response.Body) {
      return { success: false, message: `No latest.db cloud backup found for warehouse ${warehouseFolder}.` };
    }

    const byteArray = await response.Body.transformToByteArray();
    const fileBuffer = Buffer.from(byteArray);

    if (fileBuffer.length === 0) {
      return { success: false, message: 'Cloud backup file was empty.' };
    }

    // Close active SQLite connection before overwriting
    const { closeDb, getDb } = require('./database');
    closeDb();

    // Create safety copy of current db before overwriting
    if (fs.existsSync(dbPath)) {
      const safetyCopy = `${dbPath}.safety_${Date.now()}`;
      fs.copyFileSync(dbPath, safetyCopy);
    }

    // Save downloaded database
    fs.writeFileSync(dbPath, fileBuffer);

    // Also update local latest.db
    const baseBackupDir = settings.backupFolder;
    const backupDir = path.join(baseBackupDir, warehouseFolder);
    if (fs.existsSync(backupDir)) {
      fs.writeFileSync(path.join(backupDir, 'latest.db'), fileBuffer);
    }

    // Reopen database connection
    getDb();

    const sizeKb = (fileBuffer.length / 1024).toFixed(1);
    return {
      success: true,
      message: `Successfully restored live database from cloud (${warehouseFolder}/latest.db, ${sizeKb} KB)!`
    };
  } catch (err: any) {
    console.error('Cloud restore failed:', err);
    return { success: false, message: `Cloud restore failed: ${err.message || err}` };
  }
};

export const shouldRunHourlyBackup = (): boolean => {
  const settings = loadSettings();
  const lastTime = settings.lastHourlyCloudBackupTime || 0;
  return (Date.now() - lastTime) >= ONE_HOUR_MS;
};

export const shouldRun3DayBackup = (): boolean => {
  const settings = loadSettings();
  const lastTime = settings.lastCloudBackupTime || 0;
  return (Date.now() - lastTime) >= THREE_DAYS_MS;
};

/**
 * Checks and runs automated backups:
 * 1. 3-Day Archive backup (both local snapshot + cloud snapshot + live state latest.db)
 * 2. Hourly Live State backup (overwriting latest.db on S3, zero extra storage)
 */
export const checkAndRunPeriodicBackup = async (): Promise<{ ran: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    const last3DayTime = settings.lastCloudBackupTime || 0;
    const lastHourlyTime = settings.lastHourlyCloudBackupTime || 0;
    const now = Date.now();

    // 1. Check 3-Day Archive Backup
    if (now - last3DayTime >= THREE_DAYS_MS) {
      console.log('[Auto Backup] 3-Day periodic auto backup triggered...');
      const localRes = backupDatabase();
      console.log('[Auto Backup] 3-Day local snapshot result:', localRes.message);

      const cloudRes = await uploadBackupToCloud();
      console.log('[Auto Backup] 3-Day cloud archive result:', cloudRes.message);

      return { ran: true, message: `3-Day Archive: ${cloudRes.message}` };
    }

    // 2. Check Hourly Live State Backup
    if (now - lastHourlyTime >= ONE_HOUR_MS) {
      console.log('[Auto Backup] Hourly live state backup triggered (latest.db)...');
      const hourlyRes = await uploadLiveStateBackup();
      console.log('[Auto Backup] Hourly live state result:', hourlyRes.message);

      return { ran: true, message: `Hourly Live State: ${hourlyRes.message}` };
    }

    const remainingHourlyMin = Math.max(1, Math.round((ONE_HOUR_MS - (now - lastHourlyTime)) / (1000 * 60)));
    const remaining3DayHours = Math.max(1, Math.round((THREE_DAYS_MS - (now - last3DayTime)) / (1000 * 60 * 60)));
    console.log(`[Auto Backup Check] Next hourly live backup in ~${remainingHourlyMin} min; Next 3-day archive in ~${remaining3DayHours} hrs.`);
    return { ran: false };
  } catch (err: any) {
    console.error('Periodic backup check failed:', err);
    return { ran: false, message: err.message };
  }
};

/**
 * Restore database from a local file (or latest local file if unspecified).
 */
export const restoreDatabase = (backupFilePath?: string): { success: boolean; message: string } => {
  try {
    const settings = loadSettings();
    const dbPath = settings.databaseLocation;

    let sourcePath = backupFilePath;
    if (!sourcePath) {
      const baseBackupDir = settings.backupFolder;
      const warehouseFolder = getWarehouseFolderName(settings);
      const backupDir = path.join(baseBackupDir, warehouseFolder);
      if (!fs.existsSync(backupDir)) {
        return { success: false, message: `No backup directory found at ${backupDir}` };
      }
      const files = fs.readdirSync(backupDir)
        .filter((f) => (f.startsWith('backup_') || f === 'latest.db') && f.endsWith('.db'))
        .map((f) => ({
          name: f,
          path: path.join(backupDir, f),
          mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) {
        return { success: false, message: 'No backup files (.db) found in backup folder.' };
      }
      sourcePath = files[0].path;
    }

    if (!fs.existsSync(sourcePath)) {
      return { success: false, message: `Backup file not found: ${sourcePath}` };
    }

    // Close active SQLite connection before overwriting
    const { closeDb, getDb } = require('./database');
    closeDb();

    // Create safety copy of current db before overwriting
    if (fs.existsSync(dbPath)) {
      const safetyCopy = `${dbPath}.safety_${Date.now()}`;
      fs.copyFileSync(dbPath, safetyCopy);
    }

    // Overwrite database.db with the selected backup
    fs.copyFileSync(sourcePath, dbPath);

    // Reopen database connection
    getDb();

    const restoredFileName = path.basename(sourcePath);
    return { success: true, message: `Database successfully restored from ${restoredFileName}!` };
  } catch (err: any) {
    console.error('Database restore failed:', err);
    return { success: false, message: `Database restore failed: ${err.message || err}` };
  }
};

export const getBackupList = (): Array<{ name: string; path: string; size: string; date: string }> => {
  try {
    const settings = loadSettings();
    const baseBackupDir = settings.backupFolder;
    const warehouseFolder = getWarehouseFolderName(settings);
    const backupDir = path.join(baseBackupDir, warehouseFolder);

    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir)
      .filter((f) => (f.startsWith('backup_') || f === 'latest.db') && f.endsWith('.db'))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        const isLive = f === 'latest.db';
        return {
          name: isLive ? 'latest.db (Live Local State)' : f,
          path: fullPath,
          size: `${(stats.size / 1024).toFixed(1)} KB`,
          date: new Date(stats.mtimeMs).toLocaleString(),
          mtime: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return files.map(({ name, path, size, date }) => ({ name, path, size, date }));
  } catch (err) {
    console.error('Failed to get backup list:', err);
    return [];
  }
};

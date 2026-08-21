import * as fs from 'fs';
import * as path from 'path';
import { loadSettings, saveSettings } from './settings';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const getWarehouseFolderName = (settings: any): string => {
  const raw = (settings?.warehouseLocation || 'F_W_H').trim();
  const safeName = raw.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
  return safeName || 'F_W_H';
};

const updateLastBackupTime = () => {
  try {
    const currentSettings = loadSettings();
    saveSettings({
      ...currentSettings,
      lastCloudBackupTime: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record lastCloudBackupTime:', err);
  }
};

export const backupDatabase = (): { success: boolean; message: string } => {
  try {
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

    // Generate filename backup_YYYY_MM_DD_HH_MM.db
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const Min = String(now.getMinutes()).padStart(2, '0');
    const Sec = String(now.getSeconds()).padStart(2, '0');

    const filename = `backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;
    const destPath = path.join(backupDir, filename);

    // Simple file copy
    fs.copyFileSync(dbPath, destPath);

    // Prune backups (keep latest 30)
    pruneBackups(backupDir);

    return { success: true, message: `Backup saved in ${warehouseFolder}: ${filename}` };
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

    // Keep only the first 30
    if (backupFiles.length > 30) {
      const filesToDelete = backupFiles.slice(30);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Pruned old backup: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('Failed to prune old backups:', err);
  }
};

export const uploadBackupToCloud = async (): Promise<{ success: boolean; message: string }> => {
  try {
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
    const filename = `backups/${warehouseFolder}/backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;

    // Configure S3 client with the credentials provided
    const s3Client = new S3Client({
      region: 'ap-south-1', // Primary region
      credentials: {
        accessKeyId: 'AKIATXMECZM3MDCYHAUY',
        secretAccessKey: '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'
      }
    });

    const command = new PutObjectCommand({
      Bucket: 'dispatch-backup-i3pl',
      Key: filename,
      Body: fileBuffer
    });

    await s3Client.send(command);
    updateLastBackupTime();

    return { success: true, message: `Backup uploaded to cloud (${warehouseFolder}) successfully: ${filename}` };
  } catch (err: any) {
    console.error('Cloud upload primary failed, trying fallback region:', err);
    try {
      const settings = loadSettings();
      const dbPath = settings.databaseLocation;
      const warehouseFolder = getWarehouseFolderName(settings);
      const fileBuffer = fs.readFileSync(dbPath);

      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const Min = String(now.getMinutes()).padStart(2, '0');
      const Sec = String(now.getSeconds()).padStart(2, '0');
      const filename = `backups/${warehouseFolder}/backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;

      const s3Client = new S3Client({
        region: 'us-east-1', // Fallback region
        credentials: {
          accessKeyId: 'AKIATXMECZM3MDCYHAUY',
          secretAccessKey: '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'
        }
      });

      const command = new PutObjectCommand({
        Bucket: 'dispatch-backup-i3pl',
        Key: filename,
        Body: fileBuffer
      });

      await s3Client.send(command);
      updateLastBackupTime();
      return { success: true, message: `Backup uploaded to cloud (${warehouseFolder}) successfully: ${filename}` };
    } catch (fallbackErr: any) {
      console.error('Cloud upload fallback failed:', fallbackErr);
      return { success: false, message: `Cloud upload failed: ${fallbackErr.message || fallbackErr}` };
    }
  }
};

export const checkAndRunPeriodicBackup = async (): Promise<{ ran: boolean; message?: string }> => {
  try {
    const settings = loadSettings();
    const lastTime = settings.lastCloudBackupTime || 0;
    const now = Date.now();

    if (now - lastTime >= THREE_DAYS_MS) {
      console.log('3-Day periodic auto backup triggered (software running continuously)...');
      const localRes = backupDatabase();
      console.log('Periodic local backup result:', localRes.message);

      const cloudRes = await uploadBackupToCloud();
      console.log('Periodic cloud backup result:', cloudRes.message);

      return { ran: true, message: cloudRes.message };
    } else {
      const remainingHours = Math.round((THREE_DAYS_MS - (now - lastTime)) / (1000 * 60 * 60));
      console.log(`Periodic backup check: Next auto cloud backup due in ~${remainingHours} hours.`);
      return { ran: false };
    }
  } catch (err: any) {
    console.error('Periodic backup check failed:', err);
    return { ran: false, message: err.message };
  }
};

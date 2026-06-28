import * as fs from 'fs';
import * as path from 'path';
import { loadSettings } from './settings';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const backupDatabase = (): { success: boolean; message: string } => {
  try {
    const settings = loadSettings();
    const dbPath = settings.databaseLocation;
    const backupDir = settings.backupFolder;

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

    return { success: true, message: `Backup saved: ${filename}` };
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
    const filename = `backups/backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;

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

    return { success: true, message: `Backup uploaded to cloud successfully: ${filename}` };
  } catch (err: any) {
    console.error('Cloud upload primary failed, trying fallback region:', err);
    try {
      const settings = loadSettings();
      const dbPath = settings.databaseLocation;
      const fileBuffer = fs.readFileSync(dbPath);

      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const Min = String(now.getMinutes()).padStart(2, '0');
      const Sec = String(now.getSeconds()).padStart(2, '0');
      const filename = `backups/backup_${YYYY}_${MM}_${DD}_${HH}_${Min}_${Sec}.db`;

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
      return { success: true, message: `Backup uploaded to cloud successfully: ${filename}` };
    } catch (fallbackErr: any) {
      console.error('Cloud upload fallback failed:', fallbackErr);
      return { success: false, message: `Cloud upload failed: ${fallbackErr.message || fallbackErr}` };
    }
  }
};

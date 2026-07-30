import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { BrowserWindow } from "electron";

autoUpdater.logger = log;
autoUpdater.autoDownload = false;

export function initUpdater(window: BrowserWindow) {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    window.webContents.send('updater:status', { event: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    window.webContents.send('updater:status', { event: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
    window.webContents.send('updater:status', { event: 'not-available', info });
  });

  autoUpdater.on('error', (err) => {
    log.error('Updater error:', err);
    window.webContents.send('updater:status', { event: 'error', error: err?.message || String(err) });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log.info('Download progress:', progressObj);
    window.webContents.send('updater:status', { event: 'progress', progress: progressObj });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    window.webContents.send('updater:status', { event: 'downloaded', info });
  });
}

export function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

export function downloadUpdate() {
  autoUpdater.downloadUpdate();
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}

export function getUpdateInfo() {
  return {
    currentVersion: autoUpdater.currentVersion,
  };
}

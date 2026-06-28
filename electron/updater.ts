import { autoUpdater } from "electron-updater";
import log from "electron-log";

autoUpdater.logger = log;
autoUpdater.autoDownload = false;

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

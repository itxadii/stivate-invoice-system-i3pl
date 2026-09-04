import type { AppSettings, Dispatch, DispatchItem, PullListMaster, DashboardStats, PipelineStats } from '../types';

declare global {
  interface Window {
    electronAPI: {
      settings: {
        load(): Promise<AppSettings>;
        save(settings: AppSettings): Promise<boolean>;
      };
      db: {
        saveDispatch(dispatch: Partial<Dispatch>, items: DispatchItem[]): Promise<{ id: number; dc_no: string }>;
        deleteDispatch(id: number): Promise<boolean>;
        getDispatch(id: number): Promise<Dispatch & { items: DispatchItem[] }>;
        getAllDispatches(status?: string | string[], limit?: number, offset?: number): Promise<Dispatch[]>;
        searchDispatches(query: string, status?: string | string[], limit?: number, offset?: number): Promise<Dispatch[]>;
        searchPullList(pullListNo: string): Promise<PullListMaster | null>;
        importMasterData(rows: Partial<PullListMaster>[]): Promise<number>;
        getDashboardStats(): Promise<DashboardStats>;
        getTrendData(range: string): Promise<{ date: string; count: number }[]>;
        getReports(type: string, startDate?: string, endDate?: string, destination?: string): Promise<any[]>;
        getPipelineStats(): Promise<PipelineStats>;
      };
      backup: {
        triggerBackup(): Promise<{ success: boolean; message: string }>;
        uploadCloud(): Promise<{ success: boolean; message: string }>;
        uploadLiveStateCloud(): Promise<{ success: boolean; message: string }>;
        restoreBackup(filePath?: string): Promise<{ success: boolean; message: string }>;
        restoreCloudLatest(): Promise<{ success: boolean; message: string }>;
        getBackupList(): Promise<Array<{ name: string; path: string; size: string; date: string }>>;
      };
      print: {
        printChallan(dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }>;
        printBarcodes(items: DispatchItem[], dispatch?: Dispatch): Promise<{ success: boolean; filePath: string }>;
        printCombinedDispatch(dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }>;
      };
      clipboard?: {
        write(data: { text: string; html?: string }): Promise<boolean>;
      };
      updater: {
        check(): Promise<void>;
        download(): Promise<void>;
        install(): Promise<void>;
        getVersion(): Promise<{ currentVersion: string | { version: string } }>;
        onStatus(callback: (value: any) => void): () => void;
      };
    };
  }
}

const api = typeof window !== 'undefined' ? window.electronAPI : null;

export const settingsService = {
  load: async (): Promise<AppSettings> => {
    if (!api) throw new Error('Electron API not available');
    return api.settings.load();
  },
  save: async (settings: AppSettings): Promise<boolean> => {
    if (!api) throw new Error('Electron API not available');
    return api.settings.save(settings);
  }
};

export const databaseService = {
  saveDispatch: async (dispatch: Partial<Dispatch>, items: DispatchItem[]): Promise<{ id: number; dc_no: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.saveDispatch(dispatch, items);
  },
  deleteDispatch: async (id: number): Promise<boolean> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.deleteDispatch(id);
  },
  getDispatch: async (id: number): Promise<Dispatch & { items: DispatchItem[] }> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getDispatch(id);
  },
  getAllDispatches: async (status?: string | string[], limit?: number, offset?: number): Promise<Dispatch[]> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getAllDispatches(status, limit, offset);
  },
  searchDispatches: async (query: string, status?: string | string[], limit?: number, offset?: number): Promise<Dispatch[]> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.searchDispatches(query, status, limit, offset);
  },
  searchPullList: async (pullListNo: string): Promise<PullListMaster | null> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.searchPullList(pullListNo);
  },
  importMasterData: async (rows: Partial<PullListMaster>[]): Promise<number> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.importMasterData(rows);
  },
  getDashboardStats: async (): Promise<DashboardStats> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getDashboardStats();
  },
  getTrendData: async (range: string): Promise<{ date: string; count: number }[]> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getTrendData(range);
  },
  getReports: async (type: string, startDate?: string, endDate?: string, destination?: string): Promise<any[]> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getReports(type, startDate, endDate, destination);
  },
  getPipelineStats: async (): Promise<PipelineStats> => {
    if (!api) throw new Error('Electron API not available');
    return api.db.getPipelineStats();
  }
};

export const backupService = {
  triggerBackup: async (): Promise<{ success: boolean; message: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.triggerBackup();
  },
  uploadCloud: async (): Promise<{ success: boolean; message: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.uploadCloud();
  },
  uploadLiveStateCloud: async (): Promise<{ success: boolean; message: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.uploadLiveStateCloud();
  },
  restoreBackup: async (filePath?: string): Promise<{ success: boolean; message: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.restoreBackup(filePath);
  },
  restoreCloudLatest: async (): Promise<{ success: boolean; message: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.restoreCloudLatest();
  },
  getBackupList: async (): Promise<Array<{ name: string; path: string; size: string; date: string }>> => {
    if (!api) throw new Error('Electron API not available');
    return api.backup.getBackupList();
  }
};

export const printService = {
  printChallan: async (dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.print.printChallan(dispatch, items);
  },
  printBarcodes: async (items: DispatchItem[], dispatch?: Dispatch): Promise<{ success: boolean; filePath: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.print.printBarcodes(items, dispatch);
  },
  printCombinedDispatch: async (dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.print.printCombinedDispatch(dispatch, items);
  }
};

export const updaterService = {
  check: async (): Promise<void> => {
    if (!api) throw new Error('Electron API not available');
    return api.updater.check();
  },
  download: async (): Promise<void> => {
    if (!api) throw new Error('Electron API not available');
    return api.updater.download();
  },
  install: async (): Promise<void> => {
    if (!api) throw new Error('Electron API not available');
    return api.updater.install();
  },
  getVersion: async (): Promise<{ currentVersion: string | { version: string } }> => {
    if (!api) throw new Error('Electron API not available');
    return api.updater.getVersion();
  },
  onStatus: (callback: (value: any) => void): (() => void) => {
    if (!api) throw new Error('Electron API not available');
    return api.updater.onStatus(callback);
  }
};

export const clipboardService = {
  write: async (data: { text: string; html?: string }): Promise<boolean> => {
    if (api?.clipboard?.write) {
      try {
        await api.clipboard.write(data);
        return true;
      } catch (err) {
        console.warn('Native clipboard write failed, falling back to browser clipboard:', err);
      }
    }
    try {
      if (navigator.clipboard && window.ClipboardItem && data.html) {
        const textBlob = new Blob([data.text], { type: 'text/plain' });
        const htmlBlob = new Blob([data.html], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': textBlob, 'text/html': htmlBlob })
        ]);
        return true;
      }
      await navigator.clipboard.writeText(data.text);
      return true;
    } catch (fallbackErr) {
      console.error('All clipboard operations failed:', fallbackErr);
      return false;
    }
  }
};

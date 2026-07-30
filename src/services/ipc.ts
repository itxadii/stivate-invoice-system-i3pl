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
      };
      print: {
        printChallan(dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }>;
        printBarcodes(items: DispatchItem[]): Promise<{ success: boolean; filePath: string }>;
        printCombinedDispatch(dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }>;
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
  }
};

export const printService = {
  printChallan: async (dispatch: Dispatch, items: DispatchItem[]): Promise<{ success: boolean; filePath: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.print.printChallan(dispatch, items);
  },
  printBarcodes: async (items: DispatchItem[]): Promise<{ success: boolean; filePath: string }> => {
    if (!api) throw new Error('Electron API not available');
    return api.print.printBarcodes(items);
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

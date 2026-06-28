declare module 'better-sqlite3';

interface ElectronAPI {
  settings: {
    load: () => Promise<any>;
    save: (settings: any) => Promise<boolean>;
  };
  db: {
    saveDispatch: (dispatch: any, items: any[]) => Promise<any>;
    deleteDispatch: (id: number) => Promise<boolean>;
    getDispatch: (id: number) => Promise<any>;
    getAllDispatches: (limit?: number, offset?: number) => Promise<any[]>;
    searchDispatches: (query: string, limit?: number, offset?: number) => Promise<any[]>;
    searchPullList: (pullListNo: string) => Promise<any>;
    importMasterData: (rows: any[]) => Promise<boolean>;
    getDashboardStats: () => Promise<any>;
    getTrendData: (range: string) => Promise<any[]>;
    getReports: (type: string, startDate?: string, endDate?: string) => Promise<any>;
  };
  backup: {
    triggerBackup: () => Promise<{ success: boolean; message: string }>;
    uploadCloud: () => Promise<{ success: boolean; message: string }>;
  };
  print: {
    printChallan: (dispatch: any, items: any[]) => Promise<void>;
    printBarcodes: (items: any[]) => Promise<void>;
    printCombinedDispatch: (dispatch: any, items: any[]) => Promise<void>;
  };
  updater: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    getVersion: () => Promise<{ currentVersion: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

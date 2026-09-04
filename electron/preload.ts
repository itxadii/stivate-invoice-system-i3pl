import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },
  db: {
    saveDispatch: (dispatch: any, items: any[]) => ipcRenderer.invoke('db:saveDispatch', dispatch, items),
    deleteDispatch: (id: number) => ipcRenderer.invoke('db:deleteDispatch', id),
    getDispatch: (id: number) => ipcRenderer.invoke('db:getDispatch', id),
    getAllDispatches: (status?: string | string[], limit?: number, offset?: number) => ipcRenderer.invoke('db:getAllDispatches', status, limit, offset),
    searchDispatches: (query: string, status?: string | string[], limit?: number, offset?: number) => ipcRenderer.invoke('db:searchDispatches', query, status, limit, offset),
    searchPullList: (pullListNo: string) => ipcRenderer.invoke('db:searchPullList', pullListNo),
    importMasterData: (rows: any[]) => ipcRenderer.invoke('db:importMasterData', rows),
    getDashboardStats: () => ipcRenderer.invoke('db:getDashboardStats'),
    getTrendData: (range: string) => ipcRenderer.invoke('db:getTrendData', range),
    getReports: (type: string, startDate?: string, endDate?: string, destination?: string) => 
      ipcRenderer.invoke('db:getReports', type, startDate, endDate, destination),
    getPipelineStats: () => ipcRenderer.invoke('db:getPipelineStats'),
  },
  backup: {
    triggerBackup: () => ipcRenderer.invoke('backup:trigger'),
    uploadCloud: () => ipcRenderer.invoke('backup:uploadCloud'),
    uploadLiveStateCloud: () => ipcRenderer.invoke('backup:uploadLiveStateCloud'),
    restoreBackup: (filePath?: string) => ipcRenderer.invoke('backup:restore', filePath),
    restoreCloudLatest: () => ipcRenderer.invoke('backup:restoreCloudLatest'),
    getBackupList: () => ipcRenderer.invoke('backup:list'),
  },
  print: {
    printChallan: (dispatch: any, items: any[]) => ipcRenderer.invoke('print:challan', dispatch, items),
    printBarcodes: (items: any[], dispatch?: any) => ipcRenderer.invoke('print:barcodes', items, dispatch),
    printCombinedDispatch: (dispatch: any, items: any[]) => ipcRenderer.invoke('print:combined', dispatch, items),
  },
  clipboard: {
    write: (data: { text: string; html?: string }) => ipcRenderer.invoke('clipboard:write', data),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    onStatus: (callback: (value: any) => void) => {
      const subscription = (_event: any, value: any) => callback(value);
      ipcRenderer.on('updater:status', subscription);
      return () => {
        ipcRenderer.removeListener('updater:status', subscription);
      };
    }
  }
});

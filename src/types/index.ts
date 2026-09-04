export interface AppSettings {
  companyName: string;
  address: string;
  printer: string;
  barcodePrinter: string;
  backupFolder: string;
  databaseLocation: string;
  printsFolder: string;
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

export interface Dispatch {
  id?: number;
  dc_no: string;
  date: string;
  vehicle_no: string;
  vehicle_size?: string;
  supplier_name: string;
  address: string;
  total_pallets: number;
  total_parts: number;
  particular?: string;
  scanning_by?: string;
  verify_by?: string;
  transaction_type?: string;
  created_by: string;
  created_at?: string;
  status?: 'loading' | 'ready' | 'completed';
  is_empty_pallets?: boolean | number;
  items?: DispatchItem[];
}

export const DEFAULT_VEHICLE_SIZES = ['32 ft', '20 ft', '10 ft'];

export const getVehicleMaxPallets = (vehicleSize?: string): number => {
  if (!vehicleSize) return 16;
  const norm = vehicleSize.toLowerCase().trim();
  if (norm.includes('32')) return 16;
  if (norm.includes('20')) return 8;
  if (norm.includes('10')) return 2;
  const match = norm.match(/(\d+)/);
  if (match) {
    const ft = parseInt(match[1], 10);
    if (!isNaN(ft) && ft > 0) {
      return Math.max(1, Math.floor(ft / 2));
    }
  }
  return 16;
};

export interface DispatchItem {
  id?: number;
  dispatch_id?: number;
  pull_list_no: string;
  id_number?: string;
  kit_type?: string;
  workcell?: string;
  parts?: number;
}

export interface PullListMaster {
  pull_list_no: string;
  id_number: string;
  kit_type: string;
  workcell: string;
  parts: number;
  barcode: string;
}

export interface AuditLog {
  id: number;
  action: string;
  description: string;
  created_at: string;
}

export interface DashboardStats {
  todayDispatches: number;
  totalDispatches: number;
  totalPullLists: number;
  recentDispatches: Dispatch[];
  allDispatches?: Dispatch[];
  trendData: { date: string; count: number }[];
  supervisorShare: { name: string; count: number }[];
}

export interface DailyReport {
  date: string;
  dispatch_count: number;
  total_pallets: number;
  total_parts: number;
}

export interface MonthlyReport {
  month: string;
  dispatch_count: number;
  total_pallets: number;
  total_parts: number;
}

export interface VehicleReport {
  vehicle_no: string;
  dispatch_count: number;
  total_pallets: number;
  total_parts: number;
}

export interface SupplierReport {
  supplier_name: string;
  dispatch_count: number;
  total_pallets: number;
  total_parts: number;
}

export interface PipelineStats {
  loadingCount: number;
  readyCount: number;
  completedTodayCount: number;
  pendingPullLists: number;
  totalPullListsToday: number;
}

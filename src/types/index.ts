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
  defaultAddress: string;
  defaultSupplier: string;
  defaultScanner: string;
  defaultVerifier: string;
  defaultVehicleNo: string;
}

export interface Dispatch {
  id?: number;
  dc_no: string;
  date: string;
  vehicle_no: string;
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
  status?: 'draft' | 'completed';
  items?: DispatchItem[];
}

export interface DispatchItem {
  id?: number;
  dispatch_id?: number;
  pull_list_no: string;
  id_number: string;
  kit_type: string;
  workcell: string;
  parts: number;
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

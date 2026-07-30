import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { loadSettings } from './settings';

let dbInstance: any | null = null;
let currentDbPath = '';

export const getDb = (): any => {
  const settings = loadSettings();
  const dbPath = settings.databaseLocation;

  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      console.error('Error closing database:', e);
    }
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('journal_mode = WAL');
  currentDbPath = dbPath;

  initializeSchema(dbInstance);

  return dbInstance;
};

const initializeSchema = (db: any) => {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dc_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      vehicle_no TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      address TEXT NOT NULL,
      total_pallets INTEGER NOT NULL,
      total_parts INTEGER NOT NULL,
      particular TEXT DEFAULT 'AS PER LIST',
      scanning_by TEXT,
      verify_by TEXT,
      transaction_type TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'loading'
    );

    CREATE TABLE IF NOT EXISTS dispatch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_id INTEGER NOT NULL,
      pull_list_no TEXT NOT NULL,
      id_number TEXT NOT NULL,
      kit_type TEXT NOT NULL,
      workcell TEXT NOT NULL,
      parts INTEGER NOT NULL,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pull_list_master (
      pull_list_no TEXT PRIMARY KEY,
      id_number TEXT NOT NULL,
      kit_type TEXT NOT NULL,
      workcell TEXT NOT NULL,
      parts INTEGER NOT NULL,
      barcode TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items (dispatch_id);
    CREATE INDEX IF NOT EXISTS idx_dispatch_items_pull_list_no ON dispatch_items (pull_list_no);
    CREATE INDEX IF NOT EXISTS idx_dispatch_items_id_number ON dispatch_items (id_number);
    CREATE INDEX IF NOT EXISTS idx_dispatches_date ON dispatches (date DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_dispatches_vehicle_no ON dispatches (vehicle_no);
    CREATE INDEX IF NOT EXISTS idx_dispatches_supplier_name ON dispatches (supplier_name);
  `);

  // Migrate columns for older databases
  try {
    db.exec(`ALTER TABLE dispatches ADD COLUMN particular TEXT DEFAULT 'AS PER LIST';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE dispatches ADD COLUMN scanning_by TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE dispatches ADD COLUMN verify_by TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE dispatches ADD COLUMN transaction_type TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE dispatches ADD COLUMN status TEXT DEFAULT 'loading';`);
  } catch (e) {}
  try {
    db.exec(`UPDATE dispatches SET status = 'loading' WHERE status IS NULL OR status = '' OR status = 'draft';`);
  } catch (e) {}

  // Ensure default operator user
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount && userCount.count === 0) {
      db.prepare('INSERT INTO users (name) VALUES (?)').run('Operator');
    }
  } catch (err) {
    console.error('Failed to initialize default user:', err);
  }
};

// Log helper
export const logAudit = (action: string, description: string) => {
  try {
    const db = getDb();
    db.prepare('INSERT INTO audit_logs (action, description) VALUES (?, ?)').run(action, description);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};

// DC Number generator
export const generateDCNumber = (dateStr: string): string => {
  const db = getDb();
  try {
    const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
    const prefix = `DC-${cleanDate}-`;
    
    // Find all existing dispatches starting with this prefix
    const rows = db.prepare('SELECT dc_no FROM dispatches WHERE dc_no LIKE ?').all(`${prefix}%`) as { dc_no: string }[];
    
    let maxSeq = 0;
    for (const r of rows) {
      const suffix = r.dc_no.substring(prefix.length);
      const seq = parseInt(suffix, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    
    // Ensure the generated DC number is unique
    let nextSeq = maxSeq + 1;
    const existsStmt = db.prepare('SELECT COUNT(*) as count FROM dispatches WHERE dc_no = ?');
    while (true) {
      const checkVal = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
      const row = existsStmt.get(checkVal) as { count: number };
      if (row && row.count === 0) {
        return checkVal;
      }
      nextSeq++;
    }
  } catch (e) {
    console.error('Failed to generate DC number, falling back:', e);
    const cleanDate = dateStr.replace(/-/g, ''); // YYYYMMDD
    let seq = 1;
    const existsStmt = db.prepare('SELECT COUNT(*) as count FROM dispatches WHERE dc_no = ?');
    while (true) {
      const checkVal = `DC-${cleanDate}-${seq.toString().padStart(4, '0')}`;
      const row = existsStmt.get(checkVal) as { count: number };
      if (row && row.count === 0) {
        return checkVal;
      }
      seq++;
    }
  }
};

// CRUD operations
export const saveDispatch = (dispatch: any, items: any[]) => {
  const db = getDb();
  const runTransaction = db.transaction(() => {
    let dispatchId = dispatch.id;
    let dcNo = dispatch.dc_no;

    // Auto-resolve dispatch ID from dc_no if ID is missing to prevent duplicate inserts and unique constraint failures
    if (!dispatchId && dcNo) {
      const existing = db.prepare('SELECT id FROM dispatches WHERE dc_no = ?').get(dcNo) as { id: number } | undefined;
      if (existing) {
        dispatchId = existing.id;
      }
    }

    if (dispatchId) {
      // Update dispatch
      db.prepare(`
        UPDATE dispatches
        SET date = ?, vehicle_no = ?, supplier_name = ?, address = ?, total_pallets = ?, total_parts = ?, created_by = ?,
            particular = ?, scanning_by = ?, verify_by = ?, transaction_type = ?, status = ?
        WHERE id = ?
      `).run(
        dispatch.date,
        dispatch.vehicle_no,
        dispatch.supplier_name,
        dispatch.address || '',
        dispatch.total_pallets || 1,
        dispatch.total_parts,
        dispatch.created_by || 'Operator',
        dispatch.particular || 'AS PER LIST',
        dispatch.scanning_by || '',
        dispatch.verify_by || '',
        dispatch.transaction_type || '',
        dispatch.status || 'loading',
        dispatchId
      );

      // Clear existing items
      db.prepare('DELETE FROM dispatch_items WHERE dispatch_id = ?').run(dispatchId);
    } else {
      // Create dispatch
      if (!dcNo) {
        dcNo = generateDCNumber(dispatch.date);
      }
      const result = db.prepare(`
        INSERT INTO dispatches (dc_no, date, vehicle_no, supplier_name, address, total_pallets, total_parts, created_by,
                               particular, scanning_by, verify_by, transaction_type, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dcNo,
        dispatch.date,
        dispatch.vehicle_no,
        dispatch.supplier_name,
        dispatch.address || '',
        dispatch.total_pallets || 1,
        dispatch.total_parts,
        dispatch.created_by || 'Operator',
        dispatch.particular || 'AS PER LIST',
        dispatch.scanning_by || '',
        dispatch.verify_by || '',
        dispatch.transaction_type || '',
        dispatch.status || 'loading'
      );
      dispatchId = result.lastInsertRowid;
    }

    // Insert items
    const insertItem = db.prepare(`
      INSERT INTO dispatch_items (dispatch_id, pull_list_no, id_number, kit_type, workcell, parts)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        dispatchId,
        item.pull_list_no,
        item.id_number,
        item.kit_type,
        item.workcell,
        item.parts
      );
    }

    logAudit(
      dispatch.id ? 'UPDATE_DISPATCH' : 'CREATE_DISPATCH',
      `Saved dispatch ${dcNo} with ${items.length} items.`
    );

    return { id: dispatchId, dc_no: dcNo };
  });

  return runTransaction();
};

export const deleteDispatch = (id: number) => {
  const db = getDb();
  const dispatch = db.prepare('SELECT dc_no FROM dispatches WHERE id = ?').get(id) as { dc_no: string } | undefined;
  
  if (dispatch) {
    db.prepare('DELETE FROM dispatches WHERE id = ?').run(id);
    logAudit('DELETE_DISPATCH', `Deleted dispatch ${dispatch.dc_no} (ID: ${id})`);
    return true;
  }
  return false;
};

export const getDispatch = (id: number) => {
  const db = getDb();
  const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(id);
  if (!dispatch) return null;

  const items = db.prepare('SELECT * FROM dispatch_items WHERE dispatch_id = ?').all(id);
  return { ...dispatch, items };
};

export const getAllDispatches = (status?: string | string[], limit?: number, offset?: number) => {
  const db = getDb();
  let query = 'SELECT * FROM dispatches';
  const params: any[] = [];

  if (status) {
    if (Array.isArray(status)) {
      query += ` WHERE status IN (${status.map(() => '?').join(',')})`;
      params.push(...status);
    } else {
      query += ' WHERE status = ?';
      params.push(status);
    }
  }

  query += ' ORDER BY date DESC, id DESC';

  if (limit !== undefined && offset !== undefined) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return db.prepare(query).all(...params);
};

export const searchDispatches = (query: string, status?: string | string[], limit?: number, offset?: number) => {
  const db = getDb();
  if (!query || query.trim() === '') {
    return getAllDispatches(status, limit, offset);
  }

  const wild = `%${query}%`;
  let sql = `
    SELECT DISTINCT d.* 
    FROM dispatches d
    LEFT JOIN dispatch_items di ON d.id = di.dispatch_id
    WHERE (d.dc_no LIKE ? 
       OR d.vehicle_no LIKE ? 
       OR d.supplier_name LIKE ? 
       OR d.address LIKE ? 
       OR di.pull_list_no LIKE ?
       OR di.id_number LIKE ?
    )
  `;
  const params: any[] = [wild, wild, wild, wild, wild, wild];

  if (status) {
    if (Array.isArray(status)) {
      sql += ` AND d.status IN (${status.map(() => '?').join(',')})`;
      params.push(...status);
    } else {
      sql += ' AND d.status = ?';
      params.push(status);
    }
  }

  sql += ' ORDER BY d.date DESC, d.id DESC';

  if (limit !== undefined && offset !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  return db.prepare(sql).all(...params);
};

export const searchPullList = (pullListNo: string) => {
  const db = getDb();
  return db.prepare('SELECT * FROM pull_list_master WHERE pull_list_no = ? COLLATE NOCASE').get(pullListNo.trim());
};

export const getPullListMasterCount = () => {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM pull_list_master').get() as { count: number };
  return row?.count || 0;
};

export const importMasterData = (rows: any[]) => {
  const db = getDb();
  const runTransaction = db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO pull_list_master (pull_list_no, id_number, kit_type, workcell, parts, barcode)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    for (const r of rows) {
      if (r.pull_list_no) {
        insertStmt.run(
          r.pull_list_no.toString().trim(),
          (r.id_number || '').toString().trim(),
          (r.kit_type || '').toString().trim(),
          (r.workcell || '').toString().trim(),
          parseInt(r.parts) || 0,
          (r.barcode || r.pull_list_no || '').toString().trim()
        );
        importedCount++;
      }
    }

    logAudit('IMPORT_MASTER_DATA', `Imported ${importedCount} pull list records into master database.`);
    return importedCount;
  });

  return runTransaction();
};

export const getDashboardStats = () => {
  const db = getDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayDispatches = db.prepare('SELECT COUNT(*) as count FROM dispatches WHERE date LIKE ?').get(`${todayStr}%`) as { count: number };
  const totalDispatches = db.prepare('SELECT COUNT(*) as count FROM dispatches').get() as { count: number };
  const totalPullLists = db.prepare('SELECT COUNT(*) as count FROM pull_list_master').get() as { count: number };
  
  const recentDispatches = db.prepare('SELECT * FROM dispatches ORDER BY date DESC, id DESC LIMIT 5').all();

  // Daily dispatches trend (last 7 days of activity)
  const trendData = db.prepare(`
    SELECT SUBSTR(date, 1, 10) as date, COUNT(*) as count 
    FROM dispatches 
    GROUP BY SUBSTR(date, 1, 10) 
    ORDER BY date DESC 
    LIMIT 7
  `).all() as { date: string; count: number }[];

  // Supervisor share (Top 5)
  const supervisorShare = db.prepare(`
    SELECT supplier_name as name, COUNT(*) as count 
    FROM dispatches 
    GROUP BY supplier_name 
    ORDER BY count DESC 
    LIMIT 5
  `).all() as { name: string; count: number }[];

  return {
    todayDispatches: todayDispatches?.count || 0,
    totalDispatches: totalDispatches?.count || 0,
    totalPullLists: totalPullLists?.count || 0,
    recentDispatches: recentDispatches || [],
    trendData: trendData.reverse() || [],
    supervisorShare: supervisorShare || []
  };
};

export const getReportsData = (reportType: string, startDate?: string, endDate?: string, destination?: string) => {
  const db = getDb();
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (startDate && endDate) {
    conditions.push('SUBSTR(date, 1, 10) BETWEEN ? AND ?');
    params.push(startDate, endDate);
  } else if (startDate) {
    conditions.push('SUBSTR(date, 1, 10) >= ?');
    params.push(startDate);
  } else if (endDate) {
    conditions.push('SUBSTR(date, 1, 10) <= ?');
    params.push(endDate);
  }

  if (destination && destination !== 'ALL') {
    conditions.push('(address LIKE ? OR supplier_name LIKE ?)');
    params.push(`%${destination}%`, `%${destination}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  if (reportType === 'daily') {
    return db.prepare(`
      SELECT SUBSTR(date, 1, 10) as date, COUNT(*) as dispatch_count, SUM(total_pallets) as total_pallets, SUM(total_parts) as total_parts
      FROM dispatches
      ${whereClause}
      GROUP BY SUBSTR(date, 1, 10)
      ORDER BY date DESC
    `).all(...params);
  } else if (reportType === 'monthly') {
    return db.prepare(`
      SELECT strftime('%Y-%m', date) as month, COUNT(*) as dispatch_count, SUM(total_pallets) as total_pallets, SUM(total_parts) as total_parts
      FROM dispatches
      ${whereClause}
      GROUP BY month
      ORDER BY month DESC
    `).all(...params);
  } else if (reportType === 'vehicle') {
    return db.prepare(`
      SELECT vehicle_no, COUNT(*) as dispatch_count, SUM(total_pallets) as total_pallets, SUM(total_parts) as total_parts
      FROM dispatches
      ${whereClause}
      GROUP BY vehicle_no
      ORDER BY dispatch_count DESC
    `).all(...params);
  } else if (reportType === 'supplier') {
    return db.prepare(`
      SELECT supplier_name, COUNT(*) as dispatch_count, SUM(total_pallets) as total_pallets, SUM(total_parts) as total_parts
      FROM dispatches
      ${whereClause}
      GROUP BY supplier_name
      ORDER BY dispatch_count DESC
    `).all(...params);
  } else if (reportType === 'loading-summary') {
    const dispatches = db.prepare(`
      SELECT * FROM dispatches
      ${whereClause}
      ORDER BY date ASC, id ASC
    `).all(...params);

    const getItemsStmt = db.prepare(`
      SELECT * FROM dispatch_items WHERE dispatch_id = ? ORDER BY id ASC
    `);

    const resultRows: any[] = [];
    let srNo = 1;
    const monthsUpper = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

    for (const d of dispatches) {
      const items = getItemsStmt.all(d.id);
      
      const normDate = d.date.includes('T') ? d.date : d.date.replace(' ', 'T');
      const dateObj = new Date(normDate);

      let formattedDate = d.date.substring(0, 10);
      let outTime = '00:00';
      let monthName = 'JULY';

      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        formattedDate = `${day}-${month}-${year}`;

        const hours = String(dateObj.getHours()).padStart(2, '0');
        const mins = String(dateObj.getMinutes()).padStart(2, '0');
        outTime = `${hours}:${mins}`;

        monthName = monthsUpper[dateObj.getMonth()];
      }

      let vehicleType = d.particular || '32FT';
      if (vehicleType === 'AS PER LIST' || !vehicleType) {
        vehicleType = '32FT';
      }

      let department = d.supplier_name || 'PM';

      if (items && items.length > 0) {
        const workcellMap = new Map<string, number>();
        for (const item of items) {
          const wc = (item.workcell || item.kit_type || 'GENERAL').trim();
          workcellMap.set(wc, (workcellMap.get(wc) || 0) + 1);
        }

        let isFirstRowOfDispatch = true;
        for (const [wcName, palletCount] of workcellMap.entries()) {
          resultRows.push({
            sr_no: srNo++,
            date: formattedDate,
            vehicle_no: d.vehicle_no,
            vehicle_type: vehicleType,
            department: department,
            workcell: wcName,
            pallets: palletCount,
            out_time: outTime,
            round: isFirstRowOfDispatch ? 1 : 0,
            month: monthName,
            remark: ''
          });
          isFirstRowOfDispatch = false;
        }
      } else {
        resultRows.push({
          sr_no: srNo++,
          date: formattedDate,
          vehicle_no: d.vehicle_no,
          vehicle_type: vehicleType,
          department: department,
          workcell: 'GENERAL',
          pallets: d.total_pallets || 1,
          out_time: outTime,
          round: 1,
          month: monthName,
          remark: ''
        });
      }
    }

    return resultRows;
  }

  return [];
};

export const getTrendData = (range: string) => {
  const db = getDb();
  
  if (range === 'thisMonth') {
    const currentMonthPrefix = new Date().toISOString().substring(0, 7) + '%';
    return db.prepare(`
      SELECT SUBSTR(date, 1, 10) as date, COUNT(*) as count 
      FROM dispatches 
      WHERE date LIKE ? 
      GROUP BY SUBSTR(date, 1, 10) 
      ORDER BY date ASC
    `).all(currentMonthPrefix) as { date: string; count: number }[];
  }
  
  if (range === '6months') {
    const data = db.prepare(`
      SELECT strftime('%Y-%m', date) as date, COUNT(*) as count 
      FROM dispatches 
      GROUP BY strftime('%Y-%m', date) 
      ORDER BY date DESC 
      LIMIT 6
    `).all() as { date: string; count: number }[];
    return data.reverse();
  }
  
  if (range === 'years') {
    return db.prepare(`
      SELECT strftime('%Y', date) as date, COUNT(*) as count 
      FROM dispatches 
      GROUP BY strftime('%Y', date) 
      ORDER BY date ASC
    `).all() as { date: string; count: number }[];
  }
  
  // Default to 7days
  const data = db.prepare(`
    SELECT SUBSTR(date, 1, 10) as date, COUNT(*) as count 
    FROM dispatches 
    GROUP BY SUBSTR(date, 1, 10) 
    ORDER BY date DESC 
    LIMIT 7
  `).all() as { date: string; count: number }[];
  return data.reverse();
};

export const getPipelineStats = () => {
  const db = getDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const loadingRow = db.prepare("SELECT COUNT(*) as count FROM dispatches WHERE status = 'loading'").get() as { count: number };
  const readyRow = db.prepare("SELECT COUNT(*) as count FROM dispatches WHERE status = 'ready'").get() as { count: number };
  const completedTodayRow = db.prepare("SELECT COUNT(*) as count FROM dispatches WHERE status = 'completed' AND date LIKE ?").get(`${todayStr}%`) as { count: number };

  const activeDispatches = db.prepare("SELECT id, total_pallets FROM dispatches WHERE status IN ('loading', 'ready')").all() as { id: number; total_pallets: number }[];
  let expected = 0;
  let loaded = 0;
  for (const d of activeDispatches) {
    expected += d.total_pallets;
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM dispatch_items WHERE dispatch_id = ?').get(d.id) as { count: number };
    loaded += itemCount?.count || 0;
  }
  const pendingPullLists = Math.max(0, expected - loaded);

  const totalTodayRow = db.prepare('SELECT SUM(total_pallets) as sum FROM dispatches WHERE date LIKE ?').get(`${todayStr}%`) as { sum: number | null };
  const totalPullListsToday = totalTodayRow?.sum || 0;

  return {
    loadingCount: loadingRow?.count || 0,
    readyCount: readyRow?.count || 0,
    completedTodayCount: completedTodayRow?.count || 0,
    pendingPullLists,
    totalPullListsToday
  };
};

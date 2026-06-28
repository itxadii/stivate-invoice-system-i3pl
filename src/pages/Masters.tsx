import React, { useState, useEffect } from 'react';
import { databaseService } from '../services/ipc';
import type { PullListMaster } from '../types';
import { Upload, CheckCircle, Database, HelpCircle } from 'lucide-react';
import { SearchBox } from '../components/SearchBox';

export const Masters: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pullLists, setPullLists] = useState<PullListMaster[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [importStatus, setImportStatus] = useState<{ text: string; type: 'success' | 'error' | 'loading' } | null>(null);

  const fetchMasterCount = async () => {
    try {
      const stats = await databaseService.getDashboardStats();
      setTotalCount(stats.totalPullLists);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setPullLists([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      // Find pull list details
      const res = await databaseService.searchPullList(query.trim());
      if (res) {
        setPullLists([res]);
      } else {
        setPullLists([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchMasterCount();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ text: 'Reading file...', type: 'loading' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setImportStatus({
            text: 'Failed to import: No valid rows found. Check column headers.',
            type: 'error'
          });
          return;
        }

        setImportStatus({ text: `Inserting ${rows.length} rows into database...`, type: 'loading' });
        const count = await databaseService.importMasterData(rows);
        setImportStatus({
          text: `Success! Imported ${count} Pull Lists to offline Master table.`,
          type: 'success'
        });
        fetchMasterCount();
      } catch (err: any) {
        setImportStatus({ text: `Import failed: ${err.message || err}`, type: 'error' });
      }
    };

    reader.onerror = () => {
      setImportStatus({ text: 'Failed to read file.', type: 'error' });
    };

    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Clean and lower-case headers
    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const getIndex = (aliases: string[]) => {
      return headers.findIndex((h) => aliases.includes(h));
    };

    const pullListIdx = getIndex(['pull_list_no', 'pull list', 'pull list number', 'pull_list', 'pl_no', 'pull list no']);
    const idIdx = getIndex(['id_number', 'id', 'id number', 'id_no', 'id_number', 'id no']);
    const kitIdx = getIndex(['kit_type', 'kit', 'kit type', 'kit_type', 'kit type']);
    const workcellIdx = getIndex(['workcell', 'work cell', 'workcell', 'cell']);
    const partsIdx = getIndex(['parts', 'parts count', 'parts_count', 'qty', 'quantity', 'count', 'no of parts', 'parts count']);

    if (pullListIdx === -1) {
      throw new Error("Could not find 'Pull List Number' column in CSV header.");
    }

    const rows: Partial<PullListMaster>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Regex handles double quotes containing commas
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ''));

      const pull_list_no = cols[pullListIdx] || '';
      if (!pull_list_no) continue;

      rows.push({
        pull_list_no,
        id_number: idIdx !== -1 ? cols[idIdx] || '' : '',
        kit_type: kitIdx !== -1 ? cols[kitIdx] || '' : '',
        workcell: workcellIdx !== -1 ? cols[workcellIdx] || '' : '',
        parts: partsIdx !== -1 ? parseInt(cols[partsIdx]) || 0 : 0,
        barcode: pull_list_no
      });
    }

    return rows;
  };

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Master Storage size</span>
            <h3 className="text-4xl font-extrabold text-slate-800 flex items-center gap-2">
              <Database size={24} className="text-emerald-600" />
              {totalCount}
            </h3>
            <p className="text-xs text-slate-500">Recorded Pull Lists in SQLite</p>
          </div>
        </div>

        {/* SAP Import Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2 space-y-4">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Import SAP Master CSV</h4>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="flex items-center gap-2 px-5 py-2.5 bg-[#4BB8FA] hover:bg-[#35a0dc] text-slate-900 rounded-lg text-sm font-bold cursor-pointer transition-colors duration-150">
              <Upload size={16} />
              <span>Select SAP CSV File</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <div className="text-xs text-slate-400 leading-normal flex items-start gap-1.5 max-w-sm">
              <HelpCircle size={15} className="text-slate-300 mt-0.5 shrink-0" />
              <p>
                Columns mapped automatically: <strong>Pull List Number</strong>, <strong>ID Number</strong>, <strong>Kit Type</strong>, <strong>Workcell</strong>, <strong>Parts</strong>.
              </p>
            </div>
          </div>

          {importStatus && (
            <div className={`p-4 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
              importStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : importStatus.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-slate-50 text-slate-800 border-slate-200 animate-pulse'
            }`}>
              {importStatus.type === 'success' && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
              <span>{importStatus.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Query Search Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Search Pull List Master</h4>
        
        <div className="flex items-center gap-4">
          <SearchBox
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Type exact Pull List Number..."
          />
          {searching && <span className="text-xs text-slate-400 animate-pulse">Searching...</span>}
        </div>

        {searchQuery && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-4">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pull List Number</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID Number</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kit Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Workcell</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Parts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pullLists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 font-medium">
                      No matching master Pull List found.
                    </td>
                  </tr>
                ) : (
                  pullLists.map((p) => (
                    <tr key={p.pull_list_no} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 font-bold">{p.pull_list_no}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-medium">{p.id_number}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {p.kit_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-medium">{p.workcell}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 text-right font-bold">{p.parts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

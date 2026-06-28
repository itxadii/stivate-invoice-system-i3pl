import React, { useState, useEffect } from 'react';
import { databaseService } from '../services/ipc';
import { Download, Calendar, BarChart3 } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'vehicle' | 'supplier'>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getReports(reportType, startDate || undefined, endDate || undefined);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, startDate, endDate]);

  const handleExportCSV = () => {
    if (reportData.length === 0) return;

    // Build headers based on report type
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers =
      reportType === 'daily'
        ? ['Date', 'Dispatch Count', 'Total Pallets', 'Total Parts']
        : reportType === 'monthly'
        ? ['Month', 'Dispatch Count', 'Total Pallets', 'Total Parts']
        : reportType === 'vehicle'
        ? ['Vehicle Number', 'Dispatch Count', 'Total Pallets', 'Total Parts']
        : ['Supervisor Name', 'Dispatch Count', 'Total Pallets', 'Total Parts'];

    csvContent += headers.join(',') + '\r\n';

    for (const row of reportData) {
      const colValues =
        reportType === 'daily'
          ? [row.date, row.dispatch_count, row.total_pallets, row.total_parts]
          : reportType === 'monthly'
          ? [row.month, row.dispatch_count, row.total_pallets, row.total_parts]
          : reportType === 'vehicle'
          ? [row.vehicle_no, row.dispatch_count, row.total_pallets, row.total_parts]
          : [row.supplier_name, row.dispatch_count, row.total_pallets, row.total_parts];

      csvContent += colValues.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\r\n';
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dispatch_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Control panel */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['daily', 'monthly', 'vehicle', 'supplier'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 uppercase tracking-wide cursor-pointer ${
                reportType === t
                  ? 'bg-[#4BB8FA] text-slate-900 shadow-none'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t === 'supplier' ? 'Supervisor' : t} Wise
            </button>
          ))}
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none text-slate-700 font-semibold"
            />
          </div>
          <span className="text-xs font-bold text-slate-400">to</span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none text-slate-700 font-semibold"
            />
          </div>

          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-1 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
          >
            <Download size={14} />
            <span>Excel (CSV)</span>
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-600" />
            <span>Report Summary</span>
          </h4>
          <span className="text-xs text-slate-400 font-semibold uppercase">
            {reportData.length} records found
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              Calculating analytics...
            </div>
          ) : reportData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              No dispatch data found for the selected criteria.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {reportType === 'daily'
                      ? 'Date'
                      : reportType === 'monthly'
                      ? 'Month'
                      : reportType === 'vehicle'
                      ? 'Vehicle Number'
                      : 'Supervisor Name'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-36">
                    Total Dispatches
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-36">
                    Total Pallets
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-40">
                    Total Parts Loaded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-bold uppercase font-mono">
                      {reportType === 'daily'
                        ? row.date
                        : reportType === 'monthly'
                        ? row.month
                        : reportType === 'vehicle'
                        ? row.vehicle_no
                        : row.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-700 text-right font-medium">
                      {row.dispatch_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-700 text-right font-medium">
                      {row.total_pallets}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800 text-right font-bold">
                      {row.total_parts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

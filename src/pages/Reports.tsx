import React, { useState, useEffect } from 'react';
import { databaseService, settingsService } from '../services/ipc';
import { Download, Calendar, BarChart3, MapPin } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'loading-summary' | 'daily' | 'monthly' | 'vehicle' | 'supplier'>('loading-summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDestinations = async () => {
      try {
        const s = await settingsService.load();
        if (s && s.addressesList && s.addressesList.length > 0) {
          const list = s.addressesList.map((a: string) => a.split('\n')[0].trim()).filter(Boolean);
          setDestinations(list);
        }
      } catch (e) {
        console.error('Failed to load destination list:', e);
      }
    };
    loadDestinations();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await databaseService.getReports(reportType, startDate || undefined, endDate || undefined, selectedDestination);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, startDate, endDate, selectedDestination]);

  const handleExportExcel = () => {
    if (reportData.length === 0) return;

    if (reportType === 'loading-summary') {
      const firstDate = startDate 
        ? startDate.split('-').reverse().join('-') 
        : (reportData[0]?.date || new Date().toISOString().substring(0, 10).split('-').reverse().join('-'));
      const lastDate = endDate 
        ? endDate.split('-').reverse().join('-') 
        : (reportData[reportData.length - 1]?.date || new Date().toISOString().substring(0, 10).split('-').reverse().join('-'));
      
      const monthName = reportData[0]?.month || 'JULY';
      const yearStr = (startDate || new Date().toISOString()).substring(0, 4);

      const destTitle = selectedDestination && selectedDestination !== 'ALL' 
        ? selectedDestination.toUpperCase() 
        : 'ALL DESTINATIONS';

      const titleBannerText = `I3PL TO ${destTitle} MONTH OF ${monthName} ${yearStr} [ ${firstDate} TO ${lastDate} ] LOADING SUMMARY`;

      let excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Loading Summary</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  table { border-collapse: collapse; font-family: 'Bookman Old Style', Calibri, sans-serif; }
  .banner { background-color: #ffd966; color: #000000; font-weight: bold; font-size: 12pt; text-align: center; border: 1.5pt solid #000000; padding: 6px; }
  th { background-color: #a9d08e; color: #000000; font-weight: bold; font-size: 10pt; border: 1pt solid #000000; text-align: center; padding: 4px; }
  td { border: 0.5pt solid #000000; font-size: 9.5pt; text-align: center; padding: 4px; font-family: Calibri, sans-serif; }
</style>
</head>
<body>
<table>
  <tr>
    <td colspan="11" class="banner">${titleBannerText}</td>
  </tr>
  <tr>
    <th>Sr. No</th>
    <th>Date</th>
    <th>Vehicle No</th>
    <th>Vehicle Type</th>
    <th>Department</th>
    <th>Work sell</th>
    <th>Pallets</th>
    <th>Out time</th>
    <th>ROUND</th>
    <th>Month</th>
    <th>REMARK</th>
  </tr>`;

      reportData.forEach((row, idx) => {
        excelHtml += `
  <tr>
    <td>${idx + 1}</td>
    <td>${row.date || ''}</td>
    <td>${row.vehicle_no || ''}</td>
    <td>${row.vehicle_type || ''}</td>
    <td>${row.department || ''}</td>
    <td>${row.workcell || ''}</td>
    <td>${row.pallets || 1}</td>
    <td>${row.out_time || ''}</td>
    <td>${row.round !== undefined ? row.round : 1}</td>
    <td>${row.month || ''}</td>
    <td></td>
  </tr>`;
      });

      excelHtml += `
</table>
</body>
</html>`;

      const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LOADING_SUMMARY_${destTitle.replace(/\s+/g, '_')}_${firstDate}_TO_${lastDate}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      handleExportCSV();
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;

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
          {(['loading-summary', 'daily', 'monthly', 'vehicle', 'supplier'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 uppercase tracking-wide cursor-pointer ${
                reportType === t
                  ? 'bg-[#4BB8FA] text-slate-900 shadow-none'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t === 'loading-summary' ? 'Loading Summary' : t === 'supplier' ? 'Supervisor Wise' : `${t} Wise`}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {reportType === 'loading-summary' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <MapPin size={14} className="text-slate-400" />
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="bg-transparent border-none text-xs focus:outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="ALL">All Destinations</option>
                {destinations.map((d, i) => (
                  <option key={i} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

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
            onClick={handleExportExcel}
            disabled={reportData.length === 0}
            className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-sm"
          >
            <Download size={14} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={16} className="text-emerald-600" />
            <span>{reportType === 'loading-summary' ? 'Loading Summary Report' : 'Report Summary'}</span>
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
          ) : reportType === 'loading-summary' ? (
            <div>
              {/* Title Banner preview */}
              <div className="bg-[#ffd966] text-slate-900 font-bold text-center py-2 px-4 text-xs border-b border-amber-300 uppercase tracking-wide select-none">
                I3PL TO {selectedDestination && selectedDestination !== 'ALL' ? selectedDestination.toUpperCase() : 'ALL DESTINATIONS'} MONTH OF {reportData[0]?.month || 'JULY'} {startDate ? startDate.substring(0, 4) : new Date().getFullYear()} [{startDate || 'START'} TO {endDate || 'END'}] LOADING SUMMARY
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-[#a9d08e] text-slate-900 font-bold uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-3 py-2 text-center border-r border-green-300">Sr. No</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Date</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Vehicle No</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Vehicle Type</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Department</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Work sell</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Pallets</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Out time</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">ROUND</th>
                    <th className="px-3 py-2 text-center border-r border-green-300">Month</th>
                    <th className="px-3 py-2 text-center">REMARK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-center text-slate-500 font-bold">{row.sr_no || idx + 1}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-800">{row.date}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-900">{row.vehicle_no}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{row.vehicle_type}</td>
                      <td className="px-3 py-2 text-center text-slate-700 font-bold">{row.department}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-900 bg-amber-50/20">{row.workcell}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-700">{row.pallets}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-800">{row.out_time}</td>
                      <td className={`px-3 py-2 text-center font-bold ${row.round === 1 ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-400'}`}>{row.round}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-700">{row.month}</td>
                      <td className="px-3 py-2 text-center text-slate-400"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

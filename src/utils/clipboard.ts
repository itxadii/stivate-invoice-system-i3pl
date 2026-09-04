import type { DispatchItem } from '../types';
import { clipboardService } from '../services/ipc';

export interface DispatchSummaryInfo {
  dc_no?: string;
  supplier_name?: string;
  vehicle_no?: string;
}

/**
 * Formats pull list items into Email-ready format (TSV plain text + rich HTML table)
 * Columns: ID NUMBER | Pull List No | Kit Type | Workcell | No of Parts | SUP NAME | VEHICLE NO
 * With DC Number displayed on top.
 */
export const formatDispatchPullListsForMail = (
  dispatch: DispatchSummaryInfo,
  items: DispatchItem[]
) => {
  const dcNo = dispatch.dc_no || 'N/A';
  const supName = dispatch.supplier_name || '';
  const vehicleNo = dispatch.vehicle_no || '';

  // 1. Plain text TSV format (splits cleanly into columns when pasted into Excel or emails)
  const headers = ['ID NUMBER', 'Pull List No', 'Kit Type', 'Workcell', 'No of Parts', 'SUP NAME', 'VEHICLE NO'];

  const textRows = items.map((item) => {
    const cleanPullList = (item.pull_list_no || '').replace(/_pending$/, '');
    return [
      item.id_number || '',
      cleanPullList,
      item.kit_type || '',
      item.workcell || '',
      item.parts ?? '',
      supName,
      vehicleNo,
    ].join('\t');
  });

  const plainText = `DC Number: ${dcNo}\n\n${headers.join('\t')}\n${textRows.join('\n')}`;

  // 2. HTML Table format for email clients (Outlook, Gmail, Thunderbird, Webmail)
  const thStyle =
    'border: 1px solid #cbd5e1; padding: 8px 12px; background-color: #f1f5f9; color: #0f172a; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt;';
  const tdStyle =
    'border: 1px solid #cbd5e1; padding: 6px 12px; font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; color: #1e293b;';

  const tableHeaderHtml = headers
    .map(
      (h) =>
        `<th style="${thStyle} text-align: ${h === 'No of Parts' ? 'right' : 'left'};">${h}</th>`
    )
    .join('');

  const tableRowsHtml = items
    .map((item, idx) => {
      const cleanPullList = (item.pull_list_no || '').replace(/_pending$/, '');
      const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      return `<tr style="background-color: ${bg};">
        <td style="${tdStyle} font-family: Consolas, 'Courier New', monospace;">${item.id_number || ''}</td>
        <td style="${tdStyle} font-family: Consolas, 'Courier New', monospace; font-weight: bold;">${cleanPullList}</td>
        <td style="${tdStyle}">${item.kit_type || ''}</td>
        <td style="${tdStyle}">${item.workcell || ''}</td>
        <td style="${tdStyle} text-align: right; font-weight: bold; font-family: Consolas, 'Courier New', monospace;">${item.parts ?? ''}</td>
        <td style="${tdStyle}">${supName}</td>
        <td style="${tdStyle}">${vehicleNo}</td>
      </tr>`;
    })
    .join('');

  const html = `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.4;">
    <p style="margin: 0 0 12px 0; font-size: 13pt; font-weight: bold; color: #0f172a;">
      DC Number: <span style="color: #2563eb;">${dcNo}</span>
    </p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; width: 100%; max-width: 960px;">
      <thead>
        <tr>${tableHeaderHtml}</tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
  </div>`;

  return { plainText, html, dcNo, count: items.length };
};

/**
 * Copies the formatted pull list data directly to system clipboard (both HTML and TSV).
 */
export const copyDispatchPullListsToClipboard = async (
  dispatch: DispatchSummaryInfo,
  items: DispatchItem[]
): Promise<boolean> => {
  const { plainText, html } = formatDispatchPullListsForMail(dispatch, items);
  return clipboardService.write({ text: plainText, html });
};

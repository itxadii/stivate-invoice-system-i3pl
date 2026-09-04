import { app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { loadSettings } from './settings';
import { logAudit } from './database';
import { print as printPdf } from 'pdf-to-printer';

// Code 39 Pattern Map: '0' = narrow, '1' = wide
const CODE39: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  'A': '100001001',
  'B': '001001001',
  'C': '101001000',
  'D': '000011001',
  'E': '100011000',
  'F': '001011000',
  'G': '000001101',
  'H': '100001100',
  'I': '001001100',
  'J': '000011100',
  'K': '100000011',
  'L': '001000011',
  'M': '101000010',
  'N': '000010011',
  'O': '100010010',
  'P': '001010010',
  'Q': '000000111',
  'R': '100000110',
  'S': '001000110',
  'T': '000010110',
  'U': '110000001',
  'V': '011000001',
  'W': '111000000',
  'X': '010010001',
  'Y': '110010000',
  'Z': '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  '$': '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100'
};

const drawBarcode = (
  page: any,
  text: string,
  x: number,
  y: number,
  height: number,
  narrowWidth = 0.45,
  wideWidth = 1.1
): number => {
  const cleanText = (text || '').trim().toUpperCase();
  if (!cleanText) return 0;
  const code = `*${cleanText}*`;

  // Scale barcode down if it exceeds the column width
  const maxBarcodeWidth = 230;
  const naturalCharWidth = (3 * wideWidth) + (7 * narrowWidth);
  const totalEstimatedWidth = code.length * naturalCharWidth;

  let actualNarrow = narrowWidth;
  let actualWide = wideWidth;
  if (totalEstimatedWidth > maxBarcodeWidth && totalEstimatedWidth > 0) {
    const scale = maxBarcodeWidth / totalEstimatedWidth;
    actualNarrow = Math.max(0.18, narrowWidth * scale);
    actualWide = Math.max(0.4, wideWidth * scale);
  }

  let currentX = x;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const pattern = CODE39[char] || CODE39[' '];

    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === '1';
      const width = isWide ? actualWide : actualNarrow;

      if (isBar) {
        page.drawRectangle({
          x: currentX,
          y: y,
          width: width,
          height: height,
          color: rgb(0, 0, 0),
        });
      }
      currentX += width;
    }
    currentX += actualNarrow;
  }
  return currentX - x;
};

// Helper to look up and load logo image safely
const getLogoImage = async (pdfDoc: PDFDocument) => {
  const logoPaths = [
    path.join(app.getAppPath(), 'public', 'logo.png'),
    path.join(app.getAppPath(), 'dist', 'logo.png'),
    path.join(app.getAppPath(), 'logo.png'),
    path.join(__dirname, '../public/logo.png'),
    path.join(__dirname, '../dist/logo.png'),
    path.join(__dirname, 'logo.png'),
  ];
  for (const p of logoPaths) {
    if (fs.existsSync(p)) {
      try {
        const logoBuffer = fs.readFileSync(p);
        return await pdfDoc.embedPng(logoBuffer);
      } catch (err) {
        console.error(`Failed to embed logo from path ${p}:`, err);
      }
    }
  }
  return null;
};

const wrapText = (text: string, maxChars: number): string[] => {
  if (!text || text.length <= maxChars) return [text || ''];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

const resolveAddress = (addressStr?: string): string => {
  if (addressStr && addressStr.trim() && addressStr.trim().toUpperCase() !== 'AS PER LIST') {
    return addressStr.trim();
  }
  const settings = loadSettings();
  if (settings.defaultAddress && settings.defaultAddress.trim().toUpperCase() !== 'AS PER LIST') {
    return settings.defaultAddress.trim();
  }
  if (settings.addressesList && settings.addressesList.length > 0) {
    const valid = settings.addressesList.find(
      (a: string) => a && a.trim().toUpperCase() !== 'AS PER LIST'
    );
    if (valid) return valid.trim();
  }
  return '';
};

const getConsigneeDisplayName = (addressStr?: string): string => {
  const actual = resolveAddress(addressStr);
  if (!actual) return 'CONSIGNEE';
  const firstLine = actual.split('\n')[0].trim().toUpperCase();
  return firstLine || 'CONSIGNEE';
};

const resolveDcNumber = (dispatch?: any, items?: any[]): string => {
  let dcNo = dispatch?.dc_no;
  if (dcNo && dcNo.toUpperCase() !== 'DRAFT' && dcNo.toUpperCase() !== '(AUTO-GENERATED)') {
    return dcNo;
  }
  if (items && items.length > 0 && items[0].dispatch_id) {
    try {
      const { getDispatch } = require('./database');
      const dbDisp = getDispatch(items[0].dispatch_id);
      if (dbDisp && dbDisp.dc_no && dbDisp.dc_no.toUpperCase() !== 'DRAFT') {
        return dbDisp.dc_no;
      }
    } catch (e) {}
  }
  if (dispatch?.id) {
    try {
      const { getDispatch } = require('./database');
      const dbDisp = getDispatch(dispatch.id);
      if (dbDisp && dbDisp.dc_no && dbDisp.dc_no.toUpperCase() !== 'DRAFT') {
        return dbDisp.dc_no;
      }
    } catch (e) {}
  }
  try {
    const { generateDCNumber } = require('./database');
    return generateDCNumber(dispatch?.date || new Date().toISOString());
  } catch (e) {
    return `DC-${Date.now().toString().slice(-6)}`;
  }
};

const buildChallanPage = (pdfDoc: PDFDocument, dispatch: any, font: any, fontBold: any, logo: any, settings?: any, items?: any[]) => {
  const page = pdfDoc.addPage([841.89, 595.276]);
  const { width, height } = page.getSize();
  const margin = 40;
  const printableWidth = width - margin * 2;

  let yCursor = height - margin;

  page.drawRectangle({
    x: margin,
    y: yCursor - 75,
    width: printableWidth,
    height: 75,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  let textX = margin + 10;
  if (logo) {
    page.drawImage(logo, { x: margin + 10, y: yCursor - 55, width: 70, height: 35 });
    textX = margin + 90;
  }

  page.drawText('I3PL INDIA PVT LTD', { x: textX, y: yCursor - 20, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Gat No. 1462/63, Dhoksangavi,', { x: textX, y: yCursor - 32, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Tal-Shirur, Dist-Pune, Maharashtra-412209', { x: textX, y: yCursor - 42, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Contact Number : +918625866581', { x: textX, y: yCursor - 52, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('E-mail : kitpulling.b-warehouse@i3plindia.com', { x: textX, y: yCursor - 62, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

  const rightX = margin + 420;
  page.drawLine({
    start: { x: rightX - 10, y: yCursor },
    end: { x: rightX - 10, y: yCursor - 75 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  const dcNo = resolveDcNumber(dispatch);
  page.drawText('GSTIN: 27AACCP7114K1ZB', { x: rightX, y: yCursor - 20, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Challan No: EL/${dcNo}/2026-27`, { x: rightX, y: yCursor - 38, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  let formattedDate = dispatch.date || new Date().toISOString();
  try {
    const norm = dispatch.date ? (dispatch.date.includes('T') ? dispatch.date : dispatch.date.replace(' ', 'T')) : new Date().toISOString();
    const dObj = new Date(norm);
    if (!isNaN(dObj.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let hours = dObj.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mins = String(dObj.getMinutes()).padStart(2, '0');
      formattedDate = `${dObj.getDate()}-${months[dObj.getMonth()]}-${dObj.getFullYear().toString().slice(-2)} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
    }
  } catch (e) {
    console.error('Date format issue while building challan page:', e);
  }
  page.drawText(`Date & Time: ${formattedDate}`, { x: rightX, y: yCursor - 56, size: 9.5, font, color: rgb(0.3, 0.3, 0.3) });

  yCursor -= 75;

  page.drawRectangle({
    x: margin,
    y: yCursor - 90,
    width: printableWidth,
    height: 90,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  page.drawLine({
    start: { x: rightX - 10, y: yCursor },
    end: { x: rightX - 10, y: yCursor - 90 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  page.drawText('Consignee/ Transfer To,', { x: margin + 10, y: yCursor - 15, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  const actualAddress = resolveAddress(dispatch.address);
  const addressLines = actualAddress ? actualAddress.split('\n') : [];
  let addrY = yCursor - 27;
  for (const line of addressLines) {
    page.drawText(line, { x: margin + 10, y: addrY, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
    addrY -= 11;
  }

  const whPrefix = (settings?.warehouseLocation || 'F W H').trim().toUpperCase();
  const consigneeName = getConsigneeDisplayName(dispatch.address);
  const fwhText = `${whPrefix} TO ${consigneeName}`;
  const fwhLines = wrapText(fwhText, 32);
  let fwhY = yCursor - 22;
  for (const fLine of fwhLines) {
    page.drawText(fLine, { x: rightX, y: fwhY, size: 10.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    fwhY -= 13;
  }

  page.drawText(`VEHICLE NO: ${dispatch.vehicle_no || ''}`, { x: rightX, y: yCursor - 62, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  yCursor -= 90;

  page.drawRectangle({
    x: margin,
    y: yCursor - 20,
    width: printableWidth,
    height: 20,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  page.drawText('SR NO', { x: margin + 10, y: yCursor - 14, size: 10.5, font: fontBold });
  page.drawText('PARTICULAR', { x: margin + 80, y: yCursor - 14, size: 10.5, font: fontBold });
  page.drawText('No of Pallets', { x: margin + 420, y: yCursor - 14, size: 10.5, font: fontBold });
  yCursor -= 20;

  page.drawRectangle({
    x: margin,
    y: yCursor - 120,
    width: printableWidth,
    height: 120,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  page.drawLine({ start: { x: margin + 50, y: yCursor }, end: { x: margin + 50, y: yCursor - 120 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: rightX - 10, y: yCursor }, end: { x: rightX - 10, y: yCursor - 120 }, thickness: 1, color: rgb(0, 0, 0) });

  page.drawText('1', { x: margin + 20, y: yCursor - 60, size: 11, font });

  // Resolve particular text:
  let particularText = (dispatch.particular || '').trim();
  if (!particularText || particularText.toUpperCase() === 'AS PER LIST') {
    // If there is only 1 item, or if items are manual materials, use item's name/description
    if (items && items.length === 1 && items[0].pull_list_no) {
      particularText = items[0].pull_list_no.replace(/_pending$/i, '').trim().toUpperCase();
    } else {
      particularText = 'AS PER LIST';
    }
  }

  // Draw particular text cleanly with text wrapping if needed
  const maxParticularChars = 34;
  const particularLines = wrapText(particularText, maxParticularChars);
  const startParticularY = yCursor - 60 + ((particularLines.length - 1) * 7);
  for (let i = 0; i < particularLines.length; i++) {
    page.drawText(particularLines[i], {
      x: margin + 80,
      y: startParticularY - (i * 14),
      size: 11.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  page.drawText(String(dispatch.total_pallets || 1), { x: margin + 420, y: yCursor - 60, size: 12, font: fontBold });
  yCursor -= 120;

  page.drawRectangle({
    x: margin,
    y: yCursor - 20,
    width: printableWidth,
    height: 20,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  page.drawLine({ start: { x: margin + 50, y: yCursor }, end: { x: margin + 50, y: yCursor - 20 }, thickness: 1, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: rightX - 10, y: yCursor }, end: { x: rightX - 10, y: yCursor - 20 }, thickness: 1, color: rgb(0, 0, 0) });

  page.drawText('Total', { x: margin + 80, y: yCursor - 14, size: 11, font: fontBold });
  page.drawText(String(dispatch.total_pallets || 1), { x: margin + 420, y: yCursor - 14, size: 11, font: fontBold });
  yCursor -= 20;

  page.drawRectangle({
    x: margin,
    y: yCursor - 120,
    width: printableWidth,
    height: 120,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  page.drawText(`TRANSACTION NO : - ${dispatch.transaction_type || '0'}`, { x: margin + 15, y: yCursor - 40, size: 11.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  const supName = (dispatch.supplier_name || 'MAHADEV').toUpperCase();
  page.drawText(supName, { x: width - margin - 160, y: yCursor - 40, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Authorised Signatory', { x: width - margin - 160, y: yCursor - 100, size: 10.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  page.drawText('Page 1 of 1', { x: width - margin - 60, y: 15, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
};

const buildBarcodePages = (pdfDoc: PDFDocument, items: any[], font: any, fontBold: any, logo: any, dispatch?: any) => {
  const margin = 25;
  const printableWidth = 791.89;

  const dcNo = resolveDcNumber(dispatch, items);
  let rawDateStr = dispatch?.date || new Date().toISOString();
  let dateStr = rawDateStr;
  try {
    const norm = rawDateStr.includes('T') ? rawDateStr : rawDateStr.replace(' ', 'T');
    const dObj = new Date(norm);
    if (!isNaN(dObj.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let hours = dObj.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const mins = String(dObj.getMinutes()).padStart(2, '0');
      dateStr = `${dObj.getDate()}-${months[dObj.getMonth()]}-${dObj.getFullYear().toString().slice(-2)} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
    }
  } catch (e) {}

  let palletsCount = dispatch?.total_pallets || 1;
  let vehicleNo = dispatch?.vehicle_no || '';
  let addrStr = dispatch?.address;

  if (items.length > 0 && items[0].dispatch_id) {
    try {
      const { getDispatch } = require('./database');
      const dbDisp = getDispatch(items[0].dispatch_id);
      if (dbDisp) {
        if (!dateStr || dateStr === rawDateStr) dateStr = dbDisp.date;
        palletsCount = dbDisp.total_pallets || palletsCount;
        if (!addrStr || addrStr.trim().toUpperCase() === 'AS PER LIST') {
          addrStr = dbDisp.address;
        }
        if (!vehicleNo && dbDisp.vehicle_no) {
          vehicleNo = dbDisp.vehicle_no;
        }
      }
    } catch (err) {
      console.error('Error fetching dispatch details for barcode headers:', err);
    }
  }

  // Multi-line Address: wrap at 55 chars so 3-line addresses fit cleanly without artificial breaks
  const fullAddress = resolveAddress(addrStr);
  const addrLines = (fullAddress as string)
    .split('\n')
    .flatMap((line: string) => wrapText(line.trim(), 55))
    .filter(Boolean);

  // Subheader height scaled to comfortably fit 3 lines of address with 12pt bottom padding
  const subheaderHeight = Math.max(48, 14 + addrLines.length * 11);

  const drawHeaderAndTableHeaders = (p: any, pageIndex: number, totalPages: number): number => {
    let yCursor = 595.276 - margin;

    p.drawRectangle({
      x: margin,
      y: yCursor - 30,
      width: printableWidth,
      height: 30,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    let titleX = margin + 10;
    if (logo) {
      p.drawImage(logo, { x: margin + 10, y: yCursor - 26, width: 50, height: 22 });
      titleX = margin + 70;
    }
    p.drawText('PULL LIST BARCODE SHEET', { x: titleX, y: yCursor - 21, size: 13.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    yCursor -= 30;

    // Subheader Box (Older horizontal format)
    p.drawRectangle({
      x: margin,
      y: yCursor - subheaderHeight,
      width: printableWidth,
      height: subheaderHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    // Older format contents: DC NO, NO OF PALLETS, ADDRESS, DATE & TIME
    p.drawText(`DC NO: ${dcNo}`, { x: margin + 10, y: yCursor - 14, size: 9.5, font: fontBold });
    p.drawText(`NO OF PALLETS: ${palletsCount}`, { x: margin + 155, y: yCursor - 14, size: 9.5, font: fontBold });
    p.drawText(`DATE & TIME: ${dateStr}`, { x: margin + 615, y: yCursor - 14, size: 9, font: fontBold });

    // Multi-line Address text (fits 3 lines perfectly without overlapping)
    p.drawText('ADDRESS:', { x: margin + 280, y: yCursor - 14, size: 9.5, font: fontBold });
    let addrLineY = yCursor - 14;
    for (let i = 0; i < addrLines.length; i++) {
      if (i === 0) {
        p.drawText(addrLines[i], { x: margin + 340, y: addrLineY, size: 8, font: fontBold });
      } else {
        addrLineY -= 11;
        p.drawText(addrLines[i], { x: margin + 280, y: addrLineY, size: 8, font: fontBold });
      }
    }

    yCursor -= subheaderHeight;

    p.drawRectangle({
      x: margin,
      y: yCursor - 18,
      width: printableWidth,
      height: 18,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    const colHeaders = ['S.No', 'ID NUMBER', 'Pull List No', 'Kit Type', 'Workcell', 'Parts', 'Pull List Barcode'];
    const colWidths = [35, 85, 150, 80, 130, 50, 261.89];
    let xCursor = margin;
    for (let i = 0; i < colHeaders.length; i++) {
      p.drawText(colHeaders[i], {
        x: xCursor + 6,
        y: yCursor - 13,
        size: 9.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      xCursor += colWidths[i];
    }

    p.drawText(`Page ${pageIndex} of ${totalPages}`, { x: 841.89 - margin - 70, y: 10, size: 8, font, color: rgb(0.6, 0.6, 0.6) });

    return yCursor - 18;
  };

  // Dynamically calculate capacity per page so rows never encroach bottom margin:
  const availableTableHeight = (595.276 - margin) - 30 - subheaderHeight - 18 - 25;
  const rowsPerPage = Math.min(15, Math.max(10, Math.floor(availableTableHeight / 28)));
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  let currentItemIdx = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pdfDoc.addPage([841.89, 595.276]);
    const colWidths = [35, 85, 150, 80, 130, 50, 261.89];

    let yCursor = drawHeaderAndTableHeaders(page, pageNum, totalPages);

    const pageLimit = Math.min(currentItemIdx + rowsPerPage, items.length);
    for (let idx = currentItemIdx; idx < pageLimit; idx++) {
      const item = items[idx];
      const rowHeight = 28;

      page.drawLine({
        start: { x: margin, y: yCursor - rowHeight },
        end: { x: margin + printableWidth, y: yCursor - rowHeight },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      });

      let xBorderCursor = margin;
      for (let i = 0; i <= colWidths.length; i++) {
        page.drawLine({
          start: { x: xBorderCursor, y: yCursor },
          end: { x: xBorderCursor, y: yCursor - rowHeight },
          thickness: 0.5,
          color: rgb(0, 0, 0),
        });
        if (i < colWidths.length) xBorderCursor += colWidths[i];
      }

      let xCursor = margin;
      const cleanPullListNo = (item.pull_list_no || '').replace(/_pending$/i, '');
      const vals = [
        String(idx + 1),
        item.id_number || '-',
        cleanPullListNo || '-',
        item.kit_type || '-',
        item.workcell || '-',
        item.parts && Number(item.parts) > 0 ? String(item.parts) : '-',
      ];

      for (let i = 0; i < vals.length; i++) {
        page.drawText(vals[i], {
          x: xCursor + 6,
          y: yCursor - 18,
          size: i === 2 ? 9.5 : 9,
          font: i === 2 ? fontBold : font,
          color: rgb(0.2, 0.2, 0.2),
        });
        xCursor += colWidths[i];
      }

      try {
        if (cleanPullListNo) {
          drawBarcode(page, cleanPullListNo, xCursor + 20, yCursor - 23, 19, 0.45, 1.1);
        }
      } catch (err) {
        console.error(`Failed to draw barcode for ${cleanPullListNo}:`, err);
      }

      yCursor -= rowHeight;
      currentItemIdx++;
    }
  }
};

export const printChallan = async (dispatch: any, _items: any[] = [], copies: number = 1): Promise<{ success: boolean; filePath: string }> => {
  try {
    const settings = loadSettings();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const logo = await getLogoImage(pdfDoc);

    buildChallanPage(pdfDoc, dispatch, font, fontBold, logo, settings, _items);

    const printsDir = settings.printsFolder;
    if (!fs.existsSync(printsDir)) {
      fs.mkdirSync(printsDir, { recursive: true });
    }

    const dcNo = resolveDcNumber(dispatch);
    const safeDc = dcNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    const destPath = path.join(printsDir, `challan_${safeDc}.pdf`);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(destPath, pdfBytes);

    logAudit('PRINT_CHALLAN', `Generated Challan PDF for DC ${dcNo} (${copies} copy/copies)`);

    try {
      const printOptions: any = { copies };
      if (settings.printer && settings.printer !== 'Default') {
        printOptions.printer = settings.printer;
      }
      await printPdf(destPath, printOptions);
      console.log(`Successfully sent Challan PDF (${copies} copy/copies) to printer:`, settings.printer || 'Default');
    } catch (printErr) {
      console.error('Direct printing failed. Falling back to open file:', printErr);
      await shell.openPath(destPath);
    }

    return { success: true, filePath: destPath };
  } catch (err: any) {
    console.error('Failed to generate challan PDF:', err);
    throw err;
  }
};

export const printBarcodes = async (items: any[], dispatch?: any, copies: number = 1): Promise<{ success: boolean; filePath: string }> => {
  try {
    const settings = loadSettings();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const logo = await getLogoImage(pdfDoc);

    buildBarcodePages(pdfDoc, items, font, fontBold, logo, dispatch);

    const printsDir = settings.printsFolder;
    if (!fs.existsSync(printsDir)) {
      fs.mkdirSync(printsDir, { recursive: true });
    }

    const dcNo = resolveDcNumber(dispatch, items);
    const safeDc = dcNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    const destPath = path.join(printsDir, `barcodes_${safeDc}.pdf`);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(destPath, pdfBytes);

    const barcodePagesCount = pdfDoc.getPageCount();
    logAudit('PRINT_BARCODES', `Generated Barcode sheet PDF for DC ${dcNo} with ${items.length} items across ${barcodePagesCount} page(s) (${copies} copy/copies)`);

    try {
      const printOptions: any = { copies };
      if (settings.barcodePrinter && settings.barcodePrinter !== 'Default') {
        printOptions.printer = settings.barcodePrinter;
      }
      await printPdf(destPath, printOptions);
      console.log(`Successfully sent Barcodes PDF (${copies} copy/copies, ${barcodePagesCount} page(s)) to printer:`, settings.barcodePrinter || 'Default');
    } catch (printErr) {
      console.error('Direct barcode printing failed. Falling back to open file:', printErr);
      await shell.openPath(destPath);
    }

    return { success: true, filePath: destPath };
  } catch (err: any) {
    console.error('Failed to generate barcode sheet PDF:', err);
    throw err;
  }
};

export const printCombinedDispatch = async (dispatch: any, items: any[]): Promise<{ success: boolean; filePath: string }> => {
  try {
    const settings = loadSettings();
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const logo = await getLogoImage(pdfDoc);

    buildChallanPage(pdfDoc, dispatch, font, fontBold, logo, settings, items);
    buildBarcodePages(pdfDoc, items, font, fontBold, logo, dispatch);

    const printsDir = settings.printsFolder;
    if (!fs.existsSync(printsDir)) {
      fs.mkdirSync(printsDir, { recursive: true });
    }

    const dcNo = resolveDcNumber(dispatch, items);
    const safeDc = dcNo.replace(/[^a-zA-Z0-9-_]/g, '_');
    const destPath = path.join(printsDir, `dispatch_set_${safeDc}.pdf`);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(destPath, pdfBytes);

    const totalPdfPages = pdfDoc.getPageCount();
    const barcodePagesCount = Math.max(1, totalPdfPages - 1);
    const totalPrintedPages = totalPdfPages * 3;

    logAudit(
      'PRINT_COMBINED_DISPATCH',
      `Generated combined challan + barcode print set for DC ${dcNo}: 3 Challans + ${barcodePagesCount * 3} Barcode pages (${barcodePagesCount} barcode sheet page(s), total ${totalPrintedPages} physical pages)`
    );

    // If customer has separate physical printers configured for documents vs barcodes:
    const hasSeparatePrinters =
      settings.printer &&
      settings.barcodePrinter &&
      settings.printer !== 'Default' &&
      settings.barcodePrinter !== 'Default' &&
      settings.printer !== settings.barcodePrinter;

    if (hasSeparatePrinters) {
      console.log('Detected separate document and barcode printers. Printing 3 Challans to Document Printer and 3 sets of Barcodes to Barcode Printer...');
      await printChallan(dispatch, items, 3);
      await printBarcodes(items, dispatch, 3);
      return { success: true, filePath: destPath };
    }

    try {
      const printOptions: any = {
        copies: 3,
        side: 'simplex',
      };
      const printerName = settings.printer && settings.printer !== 'Default'
        ? settings.printer
        : settings.barcodePrinter && settings.barcodePrinter !== 'Default'
          ? settings.barcodePrinter
          : undefined;
      if (printerName) {
        printOptions.printer = printerName;
      }
      await printPdf(destPath, printOptions);
      console.log(`Successfully sent combined dispatch set (3 sets, total ${totalPrintedPages} pages) to printer:`, printerName || 'Default');
    } catch (printErr) {
      console.error('Combined dispatch print failed. Falling back to open file:', printErr);
      await shell.openPath(destPath);
    }

    return { success: true, filePath: destPath };
  } catch (err: any) {
    console.error('Failed to generate combined dispatch print set:', err);
    throw err;
  }
};

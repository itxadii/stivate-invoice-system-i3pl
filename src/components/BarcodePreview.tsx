import React from 'react';

interface BarcodePreviewProps {
  value: string;
  height?: number;
}

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

export const BarcodePreview: React.FC<BarcodePreviewProps> = ({ value, height = 45 }) => {
  if (!value) return null;
  const cleanVal = `*${value.toUpperCase()}*`;

  // Build the array of elements: { isBar: boolean, isWide: boolean }
  const elements: { isBar: boolean; isWide: boolean }[] = [];

  for (let i = 0; i < cleanVal.length; i++) {
    const char = cleanVal[i];
    const pattern = CODE39[char] || CODE39[' '];

    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === '1';
      elements.push({ isBar, isWide });
    }
    // Inter-character space
    elements.push({ isBar: false, isWide: false });
  }

  return (
    <div className="flex flex-col items-center select-none bg-white p-3 rounded-lg border border-slate-100 shadow-sm w-fit mx-auto">
      <div className="flex items-stretch" style={{ height: `${height}px` }}>
        {elements.map((el, idx) => {
          const widthClass = el.isWide ? 'w-[3px]' : 'w-[1px]';
          const bgClass = el.isBar ? 'bg-slate-900' : 'bg-transparent';
          return (
            <div
              key={idx}
              className={`${widthClass} ${bgClass}`}
              style={{ flexShrink: 0 }}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono tracking-widest text-slate-500 mt-1 select-all font-semibold uppercase">
        {value}
      </span>
    </div>
  );
};

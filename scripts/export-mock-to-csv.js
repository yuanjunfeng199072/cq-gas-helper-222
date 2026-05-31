/**
 * 将 mock-stations.json 导出为可粘贴到 Google Sheets 的 CSV
 * node scripts/export-mock-to-csv.js
 */
const fs = require('fs');
const path = require('path');

const mockPath = path.join(__dirname, '..', 'data', 'mock-stations.json');
const data = JSON.parse(fs.readFileSync(mockPath, 'utf8'));

const header = ['id', 'name', 'lat', 'lng', '92号油价', '95号油价', 'discounts', 'lastUpdated', 'isFilled', 'brand', 'address', 'district'];
const lines = [header.join(',')];

data.stations.forEach((s) => {
  const discounts = (s.tags || []).join('、') || '';
  const row = [
    s.id,
    `"${(s.name || '').replace(/"/g, '""')}"`,
    s.lat,
    s.lng,
    s.isFilled !== false ? s.price92 : '',
    s.isFilled !== false ? s.price95 : '',
    `"${discounts.replace(/"/g, '""')}"`,
    s.lastUpdated || '',
    s.isFilled ? '是' : '否',
    s.brand || '',
    `"${(s.address || '').replace(/"/g, '""')}"`,
    s.district || '',
  ];
  lines.push(row.join(','));
});

const out = path.join(__dirname, '..', 'data', 'stations-for-google-sheets.csv');
fs.writeFileSync(out, '\uFEFF' + lines.join('\n'), 'utf8');
console.log('Written:', out, `(${data.stations.length} rows)`);

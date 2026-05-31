/**
 * 为 mock-stations.json 每条站点添加 isFilled、lastUpdated
 * 用法: node scripts/patch-station-meta.js
 */
const fs = require('fs');
const path = require('path');

const mockPath = path.join(__dirname, '..', 'data', 'mock-stations.json');
const data = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
const defaultUpdated = data.benchmark?.updatedAt || '2025-05-26';

/** 已录入真实数据的站点 ID（可按需修改） */
const FILLED_IDS = new Set([
  's001', 's002', 's003', 's004', 's005', 's006', 's007', 's008',
  's009', 's010', 's011', 's012',
]);

data.stations = data.stations.map((s) => {
  const filled = FILLED_IDS.has(s.id);
  return {
    ...s,
    isFilled: filled,
    lastUpdated: filled ? (s.lastUpdated || defaultUpdated) : '',
  };
});

fs.writeFileSync(mockPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const outJs = path.join(__dirname, '..', 'data', 'stations-data.js');
fs.writeFileSync(outJs, `window.MOCK_STATIONS_DATA=${JSON.stringify(data)};`, 'utf8');

const filled = data.stations.filter((s) => s.isFilled).length;
console.log(`Updated ${data.stations.length} stations, ${filled} filled, ${data.stations.length - filled} pending.`);

/**
 * 种子数据迁移脚本（阶段 2 使用）
 *
 * 用法（需先配置云开发 SDK 或输出 JSONL）:
 *   node scripts/migrate-seed.js --dry-run
 *   node scripts/migrate-seed.js --out ./seed-output
 *
 * 将 mock-stations.json 转为：
 * - stations 集合
 * - station_snapshots 集合（当前价转为 save_*）
 * - region_benchmarks 集合
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mockPath = path.join(root, 'data', 'mock-stations.json');

function toSnapshot(station, benchmark) {
  const save92 = Math.max(0, benchmark.price92 - station.price92);
  const save95 = Math.max(0, benchmark.price95 - station.price95);
  return {
    station_id: station.id,
    save_92: Math.round(save92 * 100) / 100,
    save_95: Math.round(save95 * 100) / 100,
    price_92: station.price92,
    price_95: station.price95,
    activity_schedule: '',
    activity_note: (station.tags || []).join('、'),
    data_updated_at: benchmark.updatedAt,
    version: 1,
    is_current: true,
  };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : null;

  const raw = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
  const { benchmark, stations, fillVolume, userLocation } = raw;

  const payload = {
    region_benchmarks: [{
      _id: 'chongqing_main',
      region_name: benchmark.source || '重庆主城',
      price_92: benchmark.price92,
      price_95: benchmark.price95,
      fill_volume_default: fillVolume || 50,
      effective_from: benchmark.updatedAt,
      updated_at: new Date().toISOString(),
    }],
    stations: stations.map((s) => ({
      _id: s.id,
      name: s.name,
      brand: s.brand,
      address: s.address,
      district: s.district || '',
      area: s.area || '',
      lat: s.lat,
      lng: s.lng,
      open_hours: s.openHours || '',
      tags: s.tags || [],
      status: 'active',
      source: 'seed',
    })),
    station_snapshots: stations.map((s) => toSnapshot(s, benchmark)),
    meta: { userLocation, migrated_at: new Date().toISOString() },
  };

  console.log(JSON.stringify({
    stations: payload.stations.length,
    snapshots: payload.station_snapshots.length,
    benchmark: payload.region_benchmarks[0]._id,
  }, null, 2));

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'seed.json'), JSON.stringify(payload, null, 2));
    console.log('Written:', path.join(outDir, 'seed.json'));
  }

  if (dryRun) {
    console.log('--dry-run: no cloud upload');
  } else if (!outDir) {
    console.log('Tip: use --out ./seed-output to export, then import via cloud console');
  }
}

main();

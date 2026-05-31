/**
 * Google Sheets 数据源
 * 支持：Sheets API v4（需 API Key）或公开表格 CSV 导出（无需 Key）
 */
const SheetsDataLoader = {
  /** 表头别名 → 标准字段 */
  HEADER_MAP: {
    id: 'id',
    name: 'name',
    lat: 'lat',
    lng: 'lng',
    price92: 'price92',
    price95: 'price95',
    discounts: 'discounts',
    lastupdated: 'lastUpdated',
    isfilled: 'isFilled',
    brand: 'brand',
    address: 'address',
    district: 'district',
    activitytime: 'activityTime',
    '92号油价': 'price92',
    '95号油价': 'price95',
    '92油价': 'price92',
    '95油价': 'price95',
    '92#油价': 'price92',
    '95#油价': 'price95',
    优惠: 'discounts',
    优惠活动: 'discounts',
    更新时间: 'lastUpdated',
    是否录入: 'isFilled',
  },

  getConfig() {
    return typeof SHEETS_CONFIG !== 'undefined' ? SHEETS_CONFIG : { enabled: false };
  },

  normalizeHeader(cell) {
    return String(cell || '').trim().toLowerCase().replace(/\s+/g, '');
  },

  mapHeaders(headerRow) {
    const index = {};
    headerRow.forEach((cell, i) => {
      const key = this.HEADER_MAP[this.normalizeHeader(cell)]
        || this.HEADER_MAP[String(cell).trim()];
      if (key) index[key] = i;
    });
    return index;
  },

  parseNumber(val) {
    if (val == null || val === '') return null;
    const n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  },

  rowToStation(row, colIndex, rowNum) {
    const get = (key) => {
      const i = colIndex[key];
      return i == null ? '' : row[i];
    };

    const id = String(get('id') || '').trim() || `row_${rowNum}`;
    const name = String(get('name') || '').trim();
    const lat = this.parseNumber(get('lat'));
    const lng = this.parseNumber(get('lng'));
    const price92 = this.parseNumber(get('price92'));
    const price95 = this.parseNumber(get('price95'));
    const discounts = String(get('discounts') || '').trim();
    const lastUpdated = String(get('lastUpdated') || '').trim();
    let isFilled = get('isFilled');

    if (!name || lat == null || lng == null) return null;

    if (isFilled === true || isFilled === false) {
      /* 已是布尔 */
    } else {
      const s = String(isFilled).trim().toLowerCase();
      if (s === 'true' || s === '1' || s === '是' || s === 'yes') isFilled = true;
      else if (s === 'false' || s === '0' || s === '否' || s === 'no') isFilled = false;
      else isFilled = price92 != null && price95 != null && price92 > 0 && price95 > 0;
    }

    const tags = discounts
      ? discounts.split(/[,，、;；]/).map((t) => t.trim()).filter(Boolean)
      : [];

    return {
      id,
      name,
      brand: String(get('brand') || '').trim(),
      address: String(get('address') || '').trim(),
      district: String(get('district') || '').trim(),
      lat,
      lng,
      distance: 0,
      price92: price92 ?? 0,
      price95: price95 ?? 0,
      openHours: '',
      tags,
      discounts,
      activityTime: String(get('activityTime') || '').trim() || discounts,
      isFilled: Boolean(isFilled),
      lastUpdated: isFilled ? (lastUpdated || '') : '',
    };
  },

  rowsToAppData(rows, meta = {}) {
    if (!rows.length) throw new Error('表格为空');

    const headerRow = rows[0].map((c) => String(c).trim());
    const colIndex = this.mapHeaders(headerRow);
    if (colIndex.id == null && colIndex.name == null) {
      throw new Error('表头需包含 id、name 等列，见 docs/GOOGLE_SHEETS.md');
    }

    const stations = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some((c) => String(c).trim())) continue;
      const station = this.rowToStation(row, colIndex, i + 1);
      if (station) stations.push(station);
    }

    if (!stations.length) throw new Error('未解析到有效油站行');

    const cfg = this.getConfig();
    const benchmark = {
      price92: meta.benchmark92 ?? cfg.benchmark?.price92 ?? 7.85,
      price95: meta.benchmark95 ?? cfg.benchmark?.price95 ?? 8.35,
      source: cfg.benchmark?.source || '重庆主城区域均价',
      updatedAt: meta.dataUpdatedAt || cfg.benchmark?.updatedAt || new Date().toISOString().slice(0, 10),
    };

    const latestStationUpdate = stations
      .filter((s) => s.isFilled && s.lastUpdated)
      .map((s) => s.lastUpdated)
      .sort()
      .pop();

    return {
      userLocation: { ...cfg.userLocation },
      benchmark,
      fillVolume: cfg.fillVolume ?? 50,
      stations,
      dataSource: 'google-sheets',
      dataFetchedAt: new Date().toISOString(),
      dataUpdatedAt: meta.dataUpdatedAt || latestStationUpdate || benchmark.updatedAt,
      sheetUrl: meta.sheetUrl || cfg.spreadsheetUrl || '',
    };
  },

  parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        if (row.some((c) => String(c).trim())) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      if (row.some((c) => String(c).trim())) rows.push(row);
    }
    return rows;
  },

  async fetchViaApi(cfg) {
    const range = encodeURIComponent(cfg.range || 'Sheet1!A:Z');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}/values/${range}?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Sheets API ${res.status}`);
    }
    const json = await res.json();
    return json.values || [];
  },

  async fetchViaCsv(cfg) {
    const gid = cfg.gid ?? '0';
    const url = `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/export?format=csv&gid=${gid}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`CSV 导出失败 ${res.status}，请将表格设为「知道链接的任何人可查看」`);
    const text = await res.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('sign in')) {
      throw new Error('无法读取表格，请检查公开权限或改用 API Key');
    }
    return this.parseCsv(text);
  },

  async load() {
    const cfg = this.getConfig();
    if (!cfg.enabled) throw new Error('SHEETS_CONFIG.enabled 未开启');
    if (!cfg.spreadsheetId || cfg.spreadsheetId.includes('YOUR_')) {
      throw new Error('请在 js/config.js 填写 SHEETS_CONFIG.spreadsheetId');
    }

    let rows;
    if (cfg.apiKey) {
      rows = await this.fetchViaApi(cfg);
    } else {
      rows = await this.fetchViaCsv(cfg);
    }

    return this.rowsToAppData(rows, {
      dataUpdatedAt: cfg.dataUpdatedAt,
      sheetUrl: cfg.spreadsheetUrl,
    });
  },
};

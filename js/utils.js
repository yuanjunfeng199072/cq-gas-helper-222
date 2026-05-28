/**
 * 计算两点间球面距离（km）
 */
function calcDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 计算单升节省金额
 * @param {number} benchmarkPrice - 区域基准价
 * @param {number} stationPrice - 加油站油价
 * @returns {number} 每升节省（负值表示更贵）
 */
function calcSavingPerLiter(benchmarkPrice, stationPrice) {
  return benchmarkPrice - stationPrice;
}

/**
 * 计算加满指定升数的预计节省
 * @param {number} benchmarkPrice
 * @param {number} stationPrice
 * @param {number} volume - 加油升数
 * @returns {number}
 */
function calcTotalSaving(benchmarkPrice, stationPrice, volume) {
  return calcSavingPerLiter(benchmarkPrice, stationPrice) * volume;
}

/**
 * 格式化金额
 * @param {number} amount
 * @returns {string}
 */
function formatMoney(amount) {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded > 0) {
    return `¥${rounded.toFixed(2)}`;
  }
  if (rounded < 0) {
    return `-¥${Math.abs(rounded).toFixed(2)}`;
  }
  return '¥0.00';
}

/**
 * 格式化距离
 * @param {number} km
 * @returns {string}
 */
function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * 格式化油价
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
  return price.toFixed(2);
}

/**
 * 格式化每升节约金额
 */
function formatSavingPerLiter(diff) {
  if (diff > 0) return `¥${diff.toFixed(2)}/L`;
  if (diff < 0) return `-¥${Math.abs(diff).toFixed(2)}/L`;
  return '持平';
}

/**
 * 筛选指定半径内加油站
 */
function filterNearbyStations(stations, maxKm) {
  return stations.filter((s) => s.distance <= maxKm);
}

/**
 * 地图用简短优惠标签，如 ↓0.13
 */
function formatMapSavingLabel(diff) {
  if (diff > 0) return `\u2193${diff.toFixed(2)}`;
  return '--';
}

/**
 * 油站活动时间（放大标签用）
 */
function getStationActivityTime(station) {
  if (station.activityTime) return String(station.activityTime).trim();
  if (station.activityRule) return String(station.activityRule).trim();
  const bestDiff = Math.max(station.diff92 || 0, station.diff95 || 0);
  if (bestDiff <= 0) return '';
  const idNum = parseInt(String(station.id).replace(/\D/g, ''), 10) || 0;
  const schedules = [
    '每周一、三、五',
    '每周二、四',
    '每日22:00-6:00',
    '周末全天',
    '每月8/18/28日',
  ];
  return schedules[idNum % schedules.length];
}

function escapeMapText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 地图放大标签 · 活动时间小字 HTML
 */
function buildMapActivityHtml(station, { compact = false } = {}) {
  const time = getStationActivityTime(station);
  if (!time) return '';
  const cls = compact ? 'map-marker-activity map-marker-activity-compact' : 'map-marker-activity';
  return `<span class="${cls}">活动时间：${escapeMapText(time)}</span>`;
}

/**
 * 油价数据更新日期（简短）
 */
function formatPriceUpdated(dateStr) {
  if (!dateStr) return '--';
  const parts = String(dateStr).split('-');
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`;
  return dateStr;
}

/**
 * 今日最推荐：附近综合每升优惠最大
 */
function getTodayBestStation(stations) {
  if (!stations.length) return null;
  const candidates = stations.filter((s) => s.diff92 > 0 || s.diff95 > 0);
  const pool = candidates.length ? candidates : stations;
  return pool.reduce((best, s) => {
    const score = Math.max(s.diff92, s.diff95);
    const bestScore = Math.max(best.diff92, best.diff95);
    if (score > bestScore) return s;
    if (score === bestScore && s.distance < best.distance) return s;
    return best;
  });
}

/**
 * 按油品每升节约排名（全部附近站点）
 */
function rankStationsByFuel(stations, fuel) {
  const key = fuel === '95' ? 'diff95' : 'diff92';
  return [...stations]
    .filter((s) => s[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.distance - b.distance);
}

/**
 * 为加油站计算节省信息
 * @param {object} station
 * @param {object} benchmark
 * @param {number} fillVolume
 * @returns {object}
 */
function enrichStation(station, benchmark, fillVolume) {
  const saving92 = calcTotalSaving(benchmark.price92, station.price92, fillVolume);
  const saving95 = calcTotalSaving(benchmark.price95, station.price95, fillVolume);
  const maxSaving = Math.max(saving92, saving95);

  return {
    ...station,
    saving92,
    saving95,
    maxSaving,
    isCheaper92: station.price92 < benchmark.price92,
    isCheaper95: station.price95 < benchmark.price95,
    diff92: calcSavingPerLiter(benchmark.price92, station.price92),
    diff95: calcSavingPerLiter(benchmark.price95, station.price95),
    priceUpdatedAt: benchmark.updatedAt || '',
  };
}

/**
 * 按指定字段排序加油站
 * @param {Array} stations
 * @param {'saving' | 'distance'} sortBy
 * @returns {Array}
 */
function sortStations(stations, sortBy) {
  const sorted = [...stations];
  if (sortBy === 'distance') {
    sorted.sort((a, b) => a.distance - b.distance);
  } else if (sortBy === 'route') {
    sorted.sort((a, b) => {
      const aOnRoute = a.routeDetourKm != null && a.routeDetourKm <= (AMAP_CONFIG.routeDetourKm || 3);
      const bOnRoute = b.routeDetourKm != null && b.routeDetourKm <= (AMAP_CONFIG.routeDetourKm || 3);
      if (aOnRoute !== bOnRoute) return aOnRoute ? -1 : 1;
      if (aOnRoute && bOnRoute) {
        return b.maxSaving - a.maxSaving || a.routeDetourKm - b.routeDetourKm;
      }
      return b.maxSaving - a.maxSaving;
    });
  } else {
    sorted.sort((a, b) => b.maxSaving - a.maxSaving);
  }
  return sorted;
}

/**
 * 点到线段的最短距离（km）
 */
function pointToSegmentDistanceKm(pLat, pLng, aLat, aLng, bLat, bLng) {
  const toXY = (lat, lng, refLat) => {
    const x = (lng - aLng) * Math.cos((refLat * Math.PI) / 180) * 111.32;
    const y = (lat - aLat) * 110.574;
    return { x, y };
  };

  const refLat = (aLat + bLat + pLat) / 3;
  const p = toXY(pLat, pLng, refLat);
  const a = { x: 0, y: 0 };
  const b = toXY(bLat, bLng, refLat);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return calcDistanceKm(pLat, pLng, aLat, aLng);
  }

  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  return calcDistanceKm(pLat, pLng, projLat, projLng);
}

/**
 * 计算站点到路线的最短偏离距离（km）
 */
function minDistanceToRouteKm(station, routePoints) {
  if (!routePoints || routePoints.length < 2) return Infinity;

  let min = Infinity;
  for (let i = 0; i < routePoints.length - 1; i += 1) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const d = pointToSegmentDistanceKm(
      station.lat, station.lng,
      a.lat, a.lng,
      b.lat, b.lng,
    );
    if (d < min) min = d;
  }
  return min;
}

/**
 * 筛选顺路加油站并按省钱+绕路排序，最多返回 maxCount 个
 */
function findOnRouteStations(stations, routePoints, maxDetourKm, maxCount = Infinity) {
  return stations
    .map((station) => ({
      ...station,
      routeDetourKm: Math.round(minDistanceToRouteKm(station, routePoints) * 10) / 10,
    }))
    .filter((s) => s.routeDetourKm <= maxDetourKm)
    .sort((a, b) => b.maxSaving - a.maxSaving || a.routeDetourKm - b.routeDetourKm)
    .slice(0, maxCount);
}

/**
 * 计算站点到路线的最近投影点（用于绘制绕路连线）
 */
function findNearestRouteSnapPoint(station, routePoints) {
  if (!routePoints || routePoints.length < 2) return null;

  let min = Infinity;
  let snap = null;

  for (let i = 0; i < routePoints.length - 1; i += 1) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const refLat = (a.lat + b.lat + station.lat) / 3;
    const toXY = (lat, lng) => ({
      x: (lng - a.lng) * Math.cos((refLat * Math.PI) / 180) * 111.32,
      y: (lat - a.lat) * 110.574,
    });

    const p = toXY(station.lat, station.lng);
    const bx = toXY(b.lat, b.lng).x;
    const by = toXY(b.lat, b.lng).y;
    const abLenSq = bx * bx + by * by;

    let projLat = a.lat;
    let projLng = a.lng;
    if (abLenSq > 0) {
      let t = (p.x * bx + p.y * by) / abLenSq;
      t = Math.max(0, Math.min(1, t));
      projLat = a.lat + t * (b.lat - a.lat);
      projLng = a.lng + t * (b.lng - a.lng);
    }

    const d = calcDistanceKm(station.lat, station.lng, projLat, projLng);
    if (d < min) {
      min = d;
      snap = {
        lat: projLat,
        lng: projLng,
        distanceKm: Math.round(d * 10) / 10,
      };
    }
  }

  return snap;
}

/**
 * 顺路最省钱加油站
 */
function findBestOnRouteStation(stations, routePoints, maxDetourKm) {
  const onRoute = findOnRouteStations(stations, routePoints, maxDetourKm);
  return onRoute[0] || null;
}

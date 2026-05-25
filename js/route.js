/**
 * 顺路加油路线模块
 */
const GasRoute = {
  path: null,
  destination: null,
  bestStation: null,
  onRouteStations: [],

  async geocodeAddress(address) {
    await GasMap.ensureAmapLoaded();
    return new Promise((resolve, reject) => {
      const geocoder = new AMap.Geocoder({ city: '重庆' });
      geocoder.getLocation(address, (status, result) => {
        if (status === 'complete' && result.geocodes?.length) {
          const geo = result.geocodes[0];
          resolve({
            lng: geo.location.lng,
            lat: geo.location.lat,
            name: geo.formattedAddress || address,
          });
        } else {
          reject(new Error('地址解析失败，请换个说法试试'));
        }
      });
    });
  },

  async planRoute(origin, destination) {
    await GasMap.ensureAmapLoaded();

    return new Promise((resolve, reject) => {
      AMap.plugin('AMap.Driving', () => {
        const driving = new AMap.Driving({
          policy: AMap.DrivingPolicy.LEAST_TIME,
        });

        driving.search(
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
          (status, result) => {
            if (status !== 'complete' || !result.routes?.length) {
              reject(new Error('路线规划失败'));
              return;
            }

            const route = result.routes[0];
            const path = [];

            route.steps.forEach((step) => {
              step.path.forEach((point) => {
                path.push({ lng: point.lng, lat: point.lat });
              });
            });

            resolve({
              path,
              distanceKm: Math.round((route.distance / 1000) * 10) / 10,
              durationMin: Math.round(route.time / 60),
            });
          },
        );
      });
    });
  },

  analyze(stations, routePath) {
    const maxDetourKm = AMAP_CONFIG.routeDetourKm || 1.5;
    this.onRouteStations = findOnRouteStations(stations, routePath, maxDetourKm);
    this.bestStation = this.onRouteStations[0] || null;
    return {
      best: this.bestStation,
      onRoute: this.onRouteStations,
      maxDetourKm,
    };
  },

  clear() {
    this.path = null;
    this.destination = null;
    this.bestStation = null;
    this.onRouteStations = [];
    GasMap.clearRoute();
  },
};

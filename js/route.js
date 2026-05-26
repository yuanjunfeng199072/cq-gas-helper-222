/**
 * 顺路加油路线模块
 */
const GasRoute = {
  path: null,
  destination: null,
  bestStation: null,
  onRouteStations: [],
  lastSuggestions: [],

  formatPoiAddress(poi) {
    return [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join('');
  },

  formatTipAddress(tip) {
    return [tip.district, tip.address].filter(Boolean).join('') || tip.name;
  },

  hasTipLocation(tip) {
    return tip?.location && typeof tip.location !== 'string'
      && tip.location.lng != null && tip.location.lat != null;
  },

  searchSuggestions(keyword) {
    return new Promise((resolve) => {
      if (!keyword || keyword.length < 2) {
        resolve([]);
        return;
      }

      AMap.plugin('AMap.AutoComplete', () => {
        const autoComplete = new AMap.Autocomplete({
          city: '重庆',
          citylimit: true,
        });
        autoComplete.search(keyword, (status, result) => {
          if (status !== 'complete' || !result.tips?.length) {
            resolve([]);
            return;
          }

          const tips = result.tips
            .filter((tip) => tip.name)
            .slice(0, 6);
          this.lastSuggestions = tips;
          resolve(tips);
        });
      });
    });
  },

  searchPoi(keyword) {
    return new Promise((resolve) => {
      AMap.plugin('AMap.PlaceSearch', () => {
        const placeSearch = new AMap.PlaceSearch({
          city: '重庆',
          citylimit: true,
          pageSize: 5,
        });
        placeSearch.search(keyword, (status, result) => {
          if (status !== 'complete' || !result.poiList?.pois?.length) {
            resolve(null);
            return;
          }

          const poi = result.poiList.pois[0];
          resolve({
            lng: poi.location.lng,
            lat: poi.location.lat,
            poiName: poi.name,
            formattedAddress: this.formatPoiAddress(poi) || poi.name,
          });
        });
      });
    });
  },

  geocodeByAddress(inputName) {
    return new Promise((resolve, reject) => {
      const geocoder = new AMap.Geocoder({ city: '重庆', citylimit: true });
      geocoder.getLocation(inputName, (status, result) => {
        if (status === 'complete' && result.geocodes?.length) {
          const geo = result.geocodes[0];
          resolve({
            lng: geo.location.lng,
            lat: geo.location.lat,
            poiName: geo.formattedAddress,
            formattedAddress: geo.formattedAddress || inputName,
          });
        } else {
          reject(new Error('地址解析失败，请换个说法试试'));
        }
      });
    });
  },

  buildDestinationFromTip(tip, inputName) {
    const name = inputName || tip.name;
    return {
      lng: tip.location.lng,
      lat: tip.location.lat,
      inputName: name,
      name,
      poiName: tip.name,
      formattedAddress: this.formatTipAddress(tip),
    };
  },

  buildDestinationFromLocated(located, inputName) {
    return {
      lng: located.lng,
      lat: located.lat,
      inputName,
      name: inputName,
      poiName: located.poiName,
      formattedAddress: located.formattedAddress,
    };
  },

  async resolveDestination(inputText, selectedTip = null) {
    await GasMap.ensureAmapLoaded();
    const inputName = inputText.trim();
    if (!inputName) throw new Error('请输入目的地');

    if (selectedTip) {
      if (this.hasTipLocation(selectedTip)) {
        return this.buildDestinationFromTip(selectedTip, selectedTip.name);
      }
      const keyword = [selectedTip.name, selectedTip.district].filter(Boolean).join('');
      const located = await this.searchPoi(keyword);
      if (located) {
        return this.buildDestinationFromLocated(located, selectedTip.name);
      }
    }

    let located = await this.searchPoi(inputName);
    if (!located) {
      located = await this.geocodeByAddress(inputName);
    }
    return this.buildDestinationFromLocated(located, inputName);
  },

  async geocodeAddress(inputText) {
    return this.resolveDestination(inputText);
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
    const maxDetourKm = AMAP_CONFIG.routeDetourKm || 3;
    const maxRecommend = AMAP_CONFIG.routeRecommendMax || 3;
    this.onRouteStations = findOnRouteStations(stations, routePath, maxDetourKm, maxRecommend);
    this.bestStation = this.onRouteStations[0] || null;
    return {
      best: this.bestStation,
      recommended: this.onRouteStations,
      onRoute: this.onRouteStations,
      maxDetourKm,
    };
  },

  clear() {
    this.path = null;
    this.destination = null;
    this.bestStation = null;
    this.onRouteStations = [];
    this.lastSuggestions = [];
    GasMap.clearRoute();
  },
};

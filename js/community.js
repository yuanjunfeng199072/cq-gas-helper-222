/**
 * 情报共建 · 轻量社区模块（localStorage，无需登录）
 */
const GasCommunity = {
  sheetOpen: false,
  getStations: () => [],

  defaultLeaderboard: [
    { name: '重庆油王', points: 128 },
    { name: '热心车主', points: 96 },
    { name: '江北老司机', points: 72 },
  ],

  dom: {},

  init(getStationsFn) {
    this.getStations = getStationsFn;
    this.dom = {
      sheet: document.getElementById('intel-sheet'),
      backdrop: document.getElementById('intel-backdrop'),
      close: document.getElementById('intel-sheet-close'),
      openBtn: document.getElementById('intel-open-btn'),
      form: document.getElementById('intel-form'),
      stationInput: document.getElementById('intel-station'),
      stationList: document.getElementById('intel-station-list'),
      save92: document.getElementById('intel-save92'),
      save95: document.getElementById('intel-save95'),
      note: document.getElementById('intel-note'),
      updatedAt: document.getElementById('intel-updated'),
      nickname: document.getElementById('intel-nickname'),
      photo: document.getElementById('intel-photo'),
      photoPreview: document.getElementById('intel-photo-preview'),
      leaderboard: document.getElementById('intel-leaderboard'),
      feed: document.getElementById('intel-feed'),
      tipBtn: document.getElementById('intel-tip-btn'),
      submitBtn: document.getElementById('intel-submit-btn'),
    };

    this.fillStationDatalist();
    this.bindEvents();
    this.render();
  },

  getStore() {
    try {
      const raw = localStorage.getItem('cq_gas_community');
      const data = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(data.tips)) data.tips = [];
      if (!data.contributors || typeof data.contributors !== 'object') data.contributors = {};
      if (!data.nickname) data.nickname = '';
      return data;
    } catch {
      return { tips: [], contributors: {}, nickname: '' };
    }
  },

  saveStore(data) {
    localStorage.setItem('cq_gas_community', JSON.stringify(data));
  },

  genNickname() {
    return `情报员${Math.floor(1000 + Math.random() * 9000)}`;
  },

  /** 统一为 -0.28 形式（每升优惠） */
  normalizeSaving(value) {
    if (value == null || value === '') return '';
    const str = String(value).trim();
    const num = parseFloat(str.replace(/[^\d.-]/g, ''));
    if (Number.isNaN(num) || num === 0) return str.startsWith('-') ? str : '';
    const abs = Math.abs(num);
    return `-${abs.toFixed(2)}`;
  },

  formatSavingLine(fuel, value) {
    const normalized = this.normalizeSaving(value);
    if (!normalized) return '';
    return `${fuel}${normalized}`;
  },

  getTipSavings(tip) {
    return [
      this.formatSavingLine('92', tip.save92),
      this.formatSavingLine('95', tip.save95),
    ].filter(Boolean).join(' · ');
  },

  fillStationDatalist() {
    const list = this.dom.stationList;
    if (!list) return;
    const stations = this.getStations();
    list.innerHTML = stations.map((s) => `<option value="${s.name}"></option>`).join('');
  },

  getLeaderboard() {
    const store = this.getStore();
    const merged = [...this.defaultLeaderboard];
    Object.entries(store.contributors).forEach(([name, points]) => {
      merged.push({ name, points });
    });
    const best = new Map();
    merged.forEach((item) => {
      const prev = best.get(item.name);
      if (!prev || item.points > prev.points) best.set(item.name, { ...item });
    });
    return Array.from(best.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  },

  renderLeaderboard() {
    if (!this.dom.leaderboard) return;
    const list = this.getLeaderboard();
    this.dom.leaderboard.innerHTML = list.map((item, i) => `
      <li class="intel-rank-item">
        <span class="intel-rank-no">${i + 1}</span>
        <span class="intel-rank-name">${this.escape(item.name)}</span>
        ${i === 0 ? '<span class="intel-rank-badge">本周情报员</span>' : ''}
        <span class="intel-rank-pts">${item.points}分</span>
      </li>
    `).join('');
  },

  renderFeed() {
    if (!this.dom.feed) return;
    const tips = this.getStore().tips;
    if (!tips.length) {
      this.dom.feed.innerHTML = '<p class="intel-feed-empty">还没有车友提交情报，来做第一个吧</p>';
      return;
    }
    this.dom.feed.innerHTML = tips.slice(0, 8).map((tip) => {
      const status = tip.status === 'adopted'
        ? '<span class="intel-tag adopted">已采纳</span>'
        : '<span class="intel-tag pending">待确认</span>';
      const savings = this.getTipSavings(tip) || '优惠待补';
      const photo = tip.photo
        ? `<img class="intel-feed-photo" src="${tip.photo}" alt="情报图片">`
        : '';
      return `
        <article class="intel-feed-item" data-id="${tip.id}">
          <div class="intel-feed-head">
            <strong>${this.escape(tip.stationName)}</strong>
            ${status}
          </div>
          <p class="intel-feed-prices">${this.escape(savings)}</p>
          ${tip.note ? `<p class="intel-feed-note">${this.escape(tip.note)}</p>` : ''}
          ${photo}
          <div class="intel-feed-meta">
            <span>${this.escape(tip.nickname)} · 更${this.formatDate(tip.updatedAt)}</span>
            <button type="button" class="intel-confirm-btn" data-confirm="${tip.id}">
              确认有用 ${tip.confirms > 0 ? `(${tip.confirms})` : ''}
            </button>
          </div>
        </article>
      `;
    }).join('');
  },

  render() {
    const store = this.getStore();
    if (this.dom.nickname && store.nickname) {
      this.dom.nickname.placeholder = store.nickname;
    }
    if (this.dom.updatedAt && !this.dom.updatedAt.value) {
      this.dom.updatedAt.value = new Date().toISOString().slice(0, 10);
    }
    this.renderLeaderboard();
    this.renderFeed();
  },

  openSheet() {
    this.fillStationDatalist();
    this.render();
    this.sheetOpen = true;
    this.dom.sheet?.classList.add('open');
    this.dom.sheet?.setAttribute('aria-hidden', 'false');
    this.dom.backdrop?.classList.remove('hidden');
  },

  closeSheet() {
    this.sheetOpen = false;
    this.dom.sheet?.classList.remove('open');
    this.dom.sheet?.setAttribute('aria-hidden', 'true');
    this.dom.backdrop?.classList.add('hidden');
  },

  /** 从站点详情打开共建表单并预填 */
  openSheetForStation(station) {
    if (!station) return;
    if (typeof closeRankSheet === 'function' && typeof sheetOpen !== 'undefined' && sheetOpen) {
      closeRankSheet();
    }
    this.openSheet();

    if (this.dom.stationInput) {
      this.dom.stationInput.value = station.name || '';
    }
    if (this.dom.save92 && station.diff92 > 0) {
      this.dom.save92.value = this.normalizeSaving(station.diff92);
    }
    if (this.dom.save95 && station.diff95 > 0) {
      this.dom.save95.value = this.normalizeSaving(station.diff95);
    }
    const activityTime = typeof getStationActivityTime === 'function'
      ? getStationActivityTime(station)
      : '';
    if (this.dom.note && activityTime && !this.dom.note.value) {
      this.dom.note.value = `活动时间：${activityTime}`;
    }
    if (this.dom.updatedAt && !this.dom.updatedAt.value) {
      this.dom.updatedAt.value = new Date().toISOString().slice(0, 10);
    }

    requestAnimationFrame(() => {
      const formSection = document.querySelector('#intel-form');
      formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.dom.note?.focus();
    });
  },

  bindEvents() {
    this.dom.openBtn?.addEventListener('click', () => {
      if (typeof closeRankSheet === 'function' && sheetOpen) closeRankSheet();
      this.openSheet();
    });
    this.dom.close?.addEventListener('click', () => this.closeSheet());
    this.dom.backdrop?.addEventListener('click', () => this.closeSheet());

    this.dom.photo?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file || !this.dom.photoPreview) return;
      if (file.size > 800000) {
        alert('图片请小于 800KB，方便大家快速加载');
        e.target.value = '';
        this.dom.photoPreview.innerHTML = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.dom.photoPreview.innerHTML = `<img src="${reader.result}" alt="预览">`;
      };
      reader.readAsDataURL(file);
    });

    this.dom.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    this.dom.feed?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-confirm]');
      if (!btn) return;
      this.confirmTip(btn.dataset.confirm);
    });

    this.dom.tipBtn?.addEventListener('click', () => {
      alert('感谢你的支持！\n\n本站由车友共同维护。若本站帮你省到了钱，可自愿打赏0.1元（演示版暂未接入支付，后续将开放微信赞赏码）。');
    });
  },

  handleSubmit() {
    const stationName = this.dom.stationInput?.value.trim();
    const save92 = this.normalizeSaving(this.dom.save92?.value.trim());
    const save95 = this.normalizeSaving(this.dom.save95?.value.trim());
    const note = this.dom.note?.value.trim();
    const updatedAt = this.dom.updatedAt?.value;
    let nickname = this.dom.nickname?.value.trim();

    if (!stationName) {
      alert('请填写加油站名称');
      return;
    }
    if (!save92 && !save95 && !note) {
      alert('请至少填写 92/95 每升优惠或活动说明');
      return;
    }

    const store = this.getStore();
    if (!nickname) nickname = store.nickname || this.genNickname();

    let photo = null;
    const previewImg = this.dom.photoPreview?.querySelector('img');
    if (previewImg) photo = previewImg.src;

    const tip = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      stationName,
      save92,
      save95,
      note,
      updatedAt: updatedAt || new Date().toISOString().slice(0, 10),
      nickname,
      photo,
      confirms: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    store.nickname = nickname;
    store.tips.unshift(tip);
    store.tips = store.tips.slice(0, 50);
    store.contributors[nickname] = (store.contributors[nickname] || 0) + 10;
    this.saveStore(store);

    this.dom.form?.reset();
    if (this.dom.photoPreview) this.dom.photoPreview.innerHTML = '';
    if (this.dom.updatedAt) this.dom.updatedAt.value = new Date().toISOString().slice(0, 10);
    if (this.dom.nickname) this.dom.nickname.value = nickname;

    this.render();
    alert(`情报已提交，感谢 ${nickname}！\n被 3 位车友确认后将标记为「已采纳」，额外 +20 积分。`);
  },

  confirmTip(id) {
    const store = this.getStore();
    const tip = store.tips.find((t) => t.id === id);
    if (!tip) return;

    const key = `cq_gas_confirmed_${id}`;
    if (sessionStorage.getItem(key)) {
      alert('你已经确认过这条情报了');
      return;
    }
    sessionStorage.setItem(key, '1');

    tip.confirms = (tip.confirms || 0) + 1;
    if (tip.confirms >= 3 && tip.status === 'pending') {
      tip.status = 'adopted';
      store.contributors[tip.nickname] = (store.contributors[tip.nickname] || 0) + 20;
    }
    this.saveStore(store);
    this.render();
  },

  formatDate(dateStr) {
    if (!dateStr) return '--';
    const parts = dateStr.split('-');
    if (parts.length >= 3) return `${parts[1]}-${parts[2]}`;
    return dateStr;
  },

  escape(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

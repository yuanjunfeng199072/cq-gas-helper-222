/**
 * 情报状态常量 · H5 / 小程序 / 云函数共用
 */
const INTEL_STATUS = {
  PENDING: 'pending',
  COMMUNITY_VERIFIED: 'community_verified',
  APPROVED: 'approved',
  MERGED: 'merged',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

const INTEL_SUBMIT_TYPE = {
  PRICE: 'price',
  ACTIVITY: 'activity',
  MIXED: 'mixed',
};

const POINT_REASON = {
  SUBMIT_INTEL: 'submit_intel',
  INTEL_ADOPTED: 'intel_adopted',
  CONFIRM_INTEL: 'confirm_intel',
  WEEKLY_BONUS: 'weekly_bonus',
  ADMIN_ADJUST: 'admin_adjust',
};

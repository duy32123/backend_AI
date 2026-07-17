'use strict';

/**
 * Category slot schemas — nguồn: Spec_cate_gia.xlsx (sheet "Máy lạnh", "Tủ Lạnh").
 *
 * Mỗi schema định nghĩa:
 *  - required: slot bắt buộc phải có trước khi sang Module 2 (Retrieval/Filter)
 *  - optional: slot có thể hỏi thêm để tăng chất lượng ranking, không chặn luồng
 *  - aliases: map field name thô (từ NLU/LLM) -> canonical slot name
 *  - validators: kiểm tra & chuẩn hoá giá trị thô -> giá trị hợp lệ theo kiểu mong muốn
 *
 * Nếu một field không có trong aliases và không trùng tên canonical nào,
 * hoặc validator trả về invalid, field đó KHÔNG được đưa vào slots — nó phải
 * được trả về trong rejected_fields để không bị "âm thầm bỏ".
 */

function toNumberVND(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/\s/g, '');
  // "20 triệu" / "20tr" / "20trieu" -> 20_000_000
  let m = s.match(/^(\d+(?:[.,]\d+)?)(triệu|trieu|tr)$/);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1_000_000);
  // "20000000" or "20,000,000"
  const digits = s.replace(/[.,]/g, '');
  if (/^\d+$/.test(digits) && digits.length >= 5) return parseInt(digits, 10);
  return null;
}

function toAreaM2(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/\s/g, '');
  const m = s.match(/^(\d+(?:[.,]\d+)?)(m2|m²)?$/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

function toHouseholdSize(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function toEnumBool(rawTrueValues) {
  return (raw) => {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw !== 'string') return null;
    const s = raw.toLowerCase().trim();
    if (rawTrueValues.includes(s)) return true;
    if (['không', 'khong', 'no', 'false'].includes(s)) return false;
    return null;
  };
}

function toNonEmptyString(raw) {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

const CATEGORY_SCHEMAS = {
  may_lanh: {
    required: ['category', 'budget_max', 'room_area_m2', 'installation_location'],
    optional: ['budget_min', 'noise_priority', 'power_saving_priority', 'sun_exposure', 'promo_preference'],
    aliases: {
      location: 'installation_location',
      'vị trí lắp': 'installation_location',
      'noi_lap_dat': 'installation_location',
      'nơi lắp đặt': 'installation_location',
      area: 'room_area_m2',
      dien_tich: 'room_area_m2',
      'diện tích': 'room_area_m2',
      budget: 'budget_max',
      ngan_sach: 'budget_max',
      'ngân sách': 'budget_max',
      max_budget: 'budget_max',
      min_budget: 'budget_min',
      quiet: 'noise_priority',
      'ưu tiên êm': 'noise_priority',
      save_power: 'power_saving_priority',
      'tiết kiệm điện': 'power_saving_priority',
      sunny: 'sun_exposure',
      'có nắng': 'sun_exposure',
      'nắng trực tiếp': 'sun_exposure',
      promo: 'promo_preference',
      'khuyến mãi': 'promo_preference',
    },
    validators: {
      category: toNonEmptyString,
      budget_max: toNumberVND,
      budget_min: toNumberVND,
      room_area_m2: toAreaM2,
      installation_location: toNonEmptyString,
      noise_priority: toEnumBool(['có', 'co', 'yes', 'true', 'ưu tiên êm']),
      power_saving_priority: toEnumBool(['có', 'co', 'yes', 'true']),
      sun_exposure: toEnumBool(['có', 'co', 'yes', 'true', 'nhiều nắng', 'bị nắng']),
      promo_preference: toEnumBool(['có', 'co', 'yes', 'true']),
    },
  },

  tu_lanh: {
    required: ['category', 'budget_max', 'household_size'],
    optional: ['budget_min', 'installation_location', 'door_type_preference', 'power_saving_priority'],
    aliases: {
      location: 'installation_location',
      'vị trí lắp': 'installation_location',
      'nơi lắp đặt': 'installation_location',
      budget: 'budget_max',
      ngan_sach: 'budget_max',
      'ngân sách': 'budget_max',
      max_budget: 'budget_max',
      min_budget: 'budget_min',
      household: 'household_size',
      'số người': 'household_size',
      so_nguoi: 'household_size',
      family_size: 'household_size',
      doors: 'door_type_preference',
      'số cửa': 'door_type_preference',
      save_power: 'power_saving_priority',
      'tiết kiệm điện': 'power_saving_priority',
    },
    validators: {
      category: toNonEmptyString,
      budget_max: toNumberVND,
      budget_min: toNumberVND,
      household_size: toHouseholdSize,
      installation_location: toNonEmptyString,
      door_type_preference: toNonEmptyString,
      power_saving_priority: toEnumBool(['có', 'co', 'yes', 'true']),
    },
  },

  // Fallback cho 12 ngành hàng còn lại (Máy giặt, Tủ đông, Máy nước nóng...)
  // cho tới khi có schema chi tiết riêng — không chặn luồng hội thoại.
  default: {
    required: ['category', 'budget_max'],
    optional: ['budget_min'],
    aliases: {
      budget: 'budget_max',
      ngan_sach: 'budget_max',
      'ngân sách': 'budget_max',
      max_budget: 'budget_max',
      min_budget: 'budget_min',
    },
    validators: {
      category: toNonEmptyString,
      budget_max: toNumberVND,
      budget_min: toNumberVND,
    },
  },
};

function getSchemaForCategory(category) {
  if (category && CATEGORY_SCHEMAS[category]) return CATEGORY_SCHEMAS[category];
  return CATEGORY_SCHEMAS.default;
}

module.exports = {
  CATEGORY_SCHEMAS,
  getSchemaForCategory,
  _helpers: { toNumberVND, toAreaM2, toHouseholdSize, toEnumBool, toNonEmptyString },
};

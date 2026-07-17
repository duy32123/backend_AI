'use strict';

const { inRange } = require('../data/parseSpecs');

const DEFAULT_TOP_N = 3;
const NEUTRAL = 50;

function productId(product) {
  return product.product_id || product.id || product.model_code || product.sku || '';
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function rangeMid(range) {
  if (!range) return null;
  if (range.max == null) return range.min;
  return (range.min + range.max) / 2;
}

function budgetScore(product, slots, missing, reasons, tradeoffs) {
  const price = product.effective_price;
  if (price == null) {
    missing.push('effective_price');
    return { score: NEUTRAL, detail: 'Thiếu giá hiệu lực; dùng điểm trung lập.' };
  }
  const max = slots.budget_max;
  const min = slots.budget_min;
  if (max == null && min == null) return { score: NEUTRAL, detail: 'Khách chưa đặt ràng buộc ngân sách.' };

  let score = 100;
  if (max != null) {
    if (price <= max) {
      const ratio = price / max;
      score = ratio >= 0.75 ? 100 : ratio >= 0.55 ? 90 : 80;
      reasons.push('Giá nằm trong ngân sách yêu cầu.');
    } else {
      const over = (price - max) / max;
      score = over <= 0.15 ? 65 : over <= 0.3 ? 40 : 15;
      tradeoffs.push('Giá vượt ngân sách yêu cầu.');
    }
  }
  if (min != null && price < min) {
    score = Math.min(score, 75);
    tradeoffs.push('Giá thấp hơn khoảng ngân sách tối thiểu khách nêu.');
  }
  return { score: clampScore(score), detail: `Giá hiệu lực ${price}.` };
}

function rangeScore(value, range, field, missing, reasons, tradeoffs, label) {
  if (value == null) return { score: NEUTRAL, detail: `Khách chưa cung cấp ${label}.` };
  if (!range) {
    missing.push(field);
    return { score: NEUTRAL, detail: `Thiếu dữ liệu ${label}; dùng điểm trung lập.` };
  }
  const matched = inRange(value, range);
  if (matched === true) {
    reasons.push(`Phù hợp ${label}.`);
    return { score: 100, detail: `${value} nằm trong khoảng ${range.min}-${range.max ?? '∞'}.` };
  }
  const mid = rangeMid(range);
  const denom = Math.max(value, mid || value, 1);
  const diff = mid == null ? Math.abs(value - range.min) : Math.abs(value - mid);
  const score = clampScore(100 - (diff / denom) * 100);
  tradeoffs.push(`Không khớp hoàn toàn ${label}.`);
  return { score, detail: `${value} ngoài khoảng ${range.min}-${range.max ?? '∞'}.` };
}

function textHasValue(text) {
  return typeof text === 'string' && text.trim().length > 0;
}

function booleanPreferenceScore(wanted, product, field, missing, reasons, label) {
  if (!wanted) return { score: NEUTRAL, detail: `Khách không ưu tiên ${label}.` };
  if (!textHasValue(product[field])) {
    missing.push(field);
    return { score: NEUTRAL, detail: `Thiếu dữ liệu ${label}; dùng điểm trung lập.` };
  }
  reasons.push(`Có dữ liệu/công nghệ liên quan ${label}.`);
  return { score: 90, detail: product[field] };
}

function noiseScore(product, slots, missing, reasons, tradeoffs) {
  if (!slots.noise_priority && slots.installation_location !== 'phòng ngủ') {
    return { score: NEUTRAL, detail: 'Khách không nêu ưu tiên độ ồn cao.' };
  }
  if (!product.noise_db) {
    missing.push('noise_db');
    return { score: NEUTRAL, detail: 'Thiếu dữ liệu độ ồn; dùng điểm trung lập.' };
  }
  const quiet = product.noise_db.min;
  let score = quiet <= 25 ? 100 : quiet <= 30 ? 90 : quiet <= 35 ? 75 : quiet <= 40 ? 55 : 35;
  if (score >= 75) reasons.push('Độ ồn phù hợp nhu cầu yên tĩnh.');
  else tradeoffs.push('Độ ồn có thể chưa tối ưu cho không gian cần yên tĩnh.');
  return { score, detail: `Độ ồn thấp nhất ${quiet} dB.` };
}

function rankMayLanh(product, slots, missing, reasons, tradeoffs) {
  return {
    budget: budgetScore(product, slots, missing, reasons, tradeoffs),
    room_area: rangeScore(slots.room_area_m2, product.room_area_range, 'room_area_range', missing, reasons, tradeoffs, 'diện tích phòng'),
    noise: noiseScore(product, slots, missing, reasons, tradeoffs),
    power_saving: booleanPreferenceScore(slots.power_saving_priority, product, 'power_saving_tech', missing, reasons, 'tiết kiệm điện'),
    sun_exposure: slots.sun_exposure === true
      ? booleanPreferenceScore(true, product, 'loai_may', missing, reasons, 'phòng nắng/nóng')
      : { score: NEUTRAL, detail: 'Khách không nêu phòng bị nắng hoặc nắng không đáng kể.' },
  };
}

function rankTuLanh(product, slots, missing, reasons, tradeoffs) {
  const doorWanted = slots.door_type_preference;
  let door = { score: NEUTRAL, detail: 'Khách không nêu loại cửa ưu tiên.' };
  if (doorWanted) {
    if (product.door_count == null && !product.kieu_dang) {
      missing.push('door_count');
      door = { score: NEUTRAL, detail: 'Thiếu dữ liệu loại/số cửa; dùng điểm trung lập.' };
    } else {
      const hay = `${product.door_count || ''} ${product.kieu_dang || ''}`.toLowerCase();
      const ok = hay.includes(String(doorWanted).toLowerCase());
      door = { score: ok ? 100 : 55, detail: hay.trim() };
      (ok ? reasons : tradeoffs).push(ok ? 'Phù hợp ưu tiên loại cửa.' : 'Loại cửa chưa khớp ưu tiên.');
    }
  }
  return {
    budget: budgetScore(product, slots, missing, reasons, tradeoffs),
    household_size: rangeScore(slots.household_size, product.household_range, 'household_range', missing, reasons, tradeoffs, 'số người sử dụng'),
    capacity: product.capacity_total_liters == null
      ? (missing.push('capacity_total_liters'), { score: NEUTRAL, detail: 'Thiếu dữ liệu dung tích; dùng điểm trung lập.' })
      : { score: 80, detail: `Dung tích ${product.capacity_total_liters} lít.` },
    door_type: door,
    power_saving: booleanPreferenceScore(slots.power_saving_priority, product, 'power_saving_tech', missing, reasons, 'tiết kiệm điện'),
  };
}

function weightedTotal(breakdown) {
  const entries = Object.values(breakdown);
  if (entries.length === 0) return NEUTRAL;
  return clampScore(entries.reduce((s, b) => s + b.score, 0) / entries.length);
}

function rankProducts(retrievalResult, stateOrSlots = {}, options = {}) {
  const topN = options.topN || DEFAULT_TOP_N;
  if (!retrievalResult || retrievalResult.status === 'not_ready') {
    return { status: 'not_ready', missing_slots: retrievalResult?.missing_slots || [], results: [] };
  }
  if (retrievalResult.status === 'no_results' || !Array.isArray(retrievalResult.products) || retrievalResult.products.length === 0) {
    return { status: 'no_results', message: retrievalResult.message || 'Không có sản phẩm để xếp hạng.', results: [] };
  }

  const slots = stateOrSlots.slots || stateOrSlots;
  const category = stateOrSlots.category || retrievalResult.products[0]?.category;
  const relaxed = retrievalResult.status === 'relaxed' ? retrievalResult.relaxed_steps || [] : [];

  const scored = retrievalResult.products.map((product) => {
    const missing = [];
    const reasons = [];
    const tradeoffs = [];
    if (relaxed.length > 0) tradeoffs.push(`Kết quả đã nới ràng buộc: ${relaxed.join(', ')}.`);
    const breakdown = category === 'tu_lanh'
      ? rankTuLanh(product, slots, missing, reasons, tradeoffs)
      : rankMayLanh(product, slots, missing, reasons, tradeoffs);
    return {
      product,
      product_id: productId(product),
      model_code: product.model_code || null,
      effective_price: product.effective_price,
      total_score: weightedTotal(breakdown),
      score_breakdown: breakdown,
      matched_reasons: reasons,
      tradeoffs,
      missing_data: [...new Set(missing)],
      relaxed_constraints: relaxed,
      source: clone(product),
    };
  });

  scored.sort((a, b) => b.total_score - a.total_score || (a.effective_price ?? Infinity) - (b.effective_price ?? Infinity) || String(a.product_id).localeCompare(String(b.product_id)));
  return { status: retrievalResult.status, relaxed_steps: retrievalResult.relaxed_steps || [], results: scored.slice(0, topN).map((r, i) => ({ rank: i + 1, ...r })) };
}

module.exports = { rankProducts, DEFAULT_TOP_N };

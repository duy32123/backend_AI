'use strict';

const { inRange } = require('../data/parseSpecs');

/**
 * filterProducts(category, slots, products) -> {
 *   status: 'ok' | 'relaxed' | 'no_results',
 *   relaxed_steps: string[],
 *   products: Product[],
 *   message: string | null
 * }
 *
 * Nguyên tắc bắt buộc (Module 2 — Retrieval/Filter):
 *  - Lọc bằng CODE trên dữ liệu catalog thật, không dùng trí nhớ LLM.
 *  - Nếu lọc chặt (strict) ra 0 kết quả, thử nới ràng buộc theo một trình
 *    tự đã định nghĩa trước (KHÔNG tự ý bịa sản phẩm), và LUÔN báo lại rõ
 *    ràng đã nới bước nào (`relaxed_steps`) để Module 3/4 và frontend biết
 *    đây không còn là kết quả khớp 100% yêu cầu.
 *  - Nếu nới hết các bước vẫn 0 kết quả -> trả về status "no_results" kèm
 *    message rõ ràng, KHÔNG được để LLM tự "chữa cháy" bằng cách bịa sản phẩm.
 */

function matchesBudget(product, slots, budgetMultiplier) {
  if (product.effective_price == null) return false; // không có giá thật -> không đưa vào tư vấn
  if (slots.budget_max != null) {
    const cap = slots.budget_max * budgetMultiplier;
    if (product.effective_price > cap) return false;
  }
  if (slots.budget_min != null && product.effective_price < slots.budget_min) return false;
  return true;
}

function areaMatches(product, slots) {
  if (slots.room_area_m2 == null) return true; // khách chưa cho slot này -> không dùng để loại
  const result = inRange(slots.room_area_m2, product.room_area_range);
  return result === true; // null (không có dữ liệu) hoặc false đều bị loại ở bước strict
}

function householdMatches(product, slots) {
  if (slots.household_size == null) return true;
  const result = inRange(slots.household_size, product.household_range);
  return result === true;
}

const MATCHERS = {
  may_lanh: (product, slots, opts) =>
    matchesBudget(product, slots, opts.budgetMultiplier) && (opts.ignoreArea || areaMatches(product, slots)),
  tu_lanh: (product, slots, opts) =>
    matchesBudget(product, slots, opts.budgetMultiplier) && (opts.ignoreHousehold || householdMatches(product, slots)),
};

function defaultMatcher(product, slots, opts) {
  return matchesBudget(product, slots, opts.budgetMultiplier);
}

// Trình tự nới ràng buộc theo category — mỗi bước sau kế thừa toàn bộ nới
// lỏng của bước trước (cumulative), chỉ thêm đúng MỘT thay đổi mới.
const RELAX_SEQUENCES = {
  may_lanh: [
    { name: 'strict', opts: { budgetMultiplier: 1, ignoreArea: false } },
    { name: 'dropped_room_area_constraint', opts: { budgetMultiplier: 1, ignoreArea: true } },
    { name: 'increased_budget_15pct', opts: { budgetMultiplier: 1.15, ignoreArea: true } },
  ],
  tu_lanh: [
    { name: 'strict', opts: { budgetMultiplier: 1, ignoreHousehold: false } },
    { name: 'dropped_household_constraint', opts: { budgetMultiplier: 1, ignoreHousehold: true } },
    { name: 'increased_budget_15pct', opts: { budgetMultiplier: 1.15, ignoreHousehold: true } },
  ],
  default: [
    { name: 'strict', opts: { budgetMultiplier: 1 } },
    { name: 'increased_budget_15pct', opts: { budgetMultiplier: 1.15 } },
  ],
};

function noResultsMessage(category) {
  const label = { may_lanh: 'máy lạnh', tu_lanh: 'tủ lạnh' }[category] || 'sản phẩm';
  return `Hiện chưa tìm thấy ${label} phù hợp trong catalog theo đúng yêu cầu, kể cả khi đã nới ngân sách và một số ràng buộc. Chưa có dữ liệu phù hợp để đề xuất — không tự bịa sản phẩm.`;
}

function filterProducts(category, slots, products) {
  const matcher = MATCHERS[category] || defaultMatcher;
  const sequence = RELAX_SEQUENCES[category] || RELAX_SEQUENCES.default;

  for (let i = 0; i < sequence.length; i += 1) {
    const step = sequence[i];
    const matched = products.filter((p) => matcher(p, slots, step.opts));
    if (matched.length > 0) {
      const relaxedSteps = sequence.slice(1, i + 1).map((s) => s.name);
      return {
        status: i === 0 ? 'ok' : 'relaxed',
        relaxed_steps: relaxedSteps,
        products: matched,
        message: null,
      };
    }
  }

  return {
    status: 'no_results',
    relaxed_steps: sequence.slice(1).map((s) => s.name),
    products: [],
    message: noResultsMessage(category),
  };
}

module.exports = { filterProducts, RELAX_SEQUENCES };

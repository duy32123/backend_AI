'use strict';

const { getSchemaForCategory } = require('../schema/categorySchemas');

// Chuẩn hoá tên category thô (tiếng Việt tự nhiên / viết tắt) về mã category canonical.
const CATEGORY_ALIASES = {
  'máy lạnh': 'may_lanh',
  'điều hòa': 'may_lanh',
  'dieu hoa': 'may_lanh',
  'may lanh': 'may_lanh',
  'ac': 'may_lanh',
  'máy điều hòa': 'may_lanh',
  'tủ lạnh': 'tu_lanh',
  'tu lanh': 'tu_lanh',
  fridge: 'tu_lanh',
  refrigerator: 'tu_lanh',
};

function normalizeCategory(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim().toLowerCase();
  if (CATEGORY_ALIASES[s]) return CATEGORY_ALIASES[s];
  // Đã là mã canonical (vd "may_lanh") thì giữ nguyên
  if (/^[a-z_]+$/.test(s)) return s;
  return null;
}

/**
 * canonicalize(rawExtraction, currentCategory)
 *
 * rawExtraction: object thô do NLU/LLM trích xuất từ tin nhắn khách hàng, vd:
 *   { location: "phòng ngủ", area: "18m2", budget: "20 triệu", foo: "bar" }
 * currentCategory: category đã biết từ turn trước (nếu có), dùng khi rawExtraction
 *   không nhắc lại category ở turn hiện tại.
 *
 * Trả về:
 *   {
 *     category: string | null,
 *     validSlots: Record<string, any>,
 *     rejectedFields: Array<{ field, reason, raw_value }>
 *   }
 *
 * Nguyên tắc: KHÔNG bao giờ âm thầm bỏ field. Field không nhận diện được
 * (không có alias, không phải canonical slot hợp lệ cho category) hoặc field
 * có giá trị không hợp lệ (validator từ chối) đều được trả về trong
 * rejectedFields kèm lý do, để caller quyết định log/hỏi lại xác nhận.
 */
function canonicalize(rawExtraction, currentCategory = null) {
  const rejectedFields = [];
  const validSlots = {};

  if (!rawExtraction || typeof rawExtraction !== 'object') {
    return { category: currentCategory, validSlots, rejectedFields };
  }

  let category = currentCategory || null;
  if (Object.prototype.hasOwnProperty.call(rawExtraction, 'category')) {
    const normalized = normalizeCategory(rawExtraction.category);
    if (normalized) {
      category = normalized;
    } else {
      rejectedFields.push({
        field: 'category',
        reason: 'unrecognized_category',
        raw_value: rawExtraction.category,
      });
    }
  }

  const schema = getSchemaForCategory(category);
  const knownCanonicalFields = new Set([...schema.required, ...schema.optional]);

  for (const [rawKey, rawValue] of Object.entries(rawExtraction)) {
    if (rawKey === 'category') continue; // đã xử lý riêng ở trên

    const canonicalKey = schema.aliases[rawKey] || (knownCanonicalFields.has(rawKey) ? rawKey : null);

    if (!canonicalKey) {
      rejectedFields.push({ field: rawKey, reason: 'unrecognized_field', raw_value: rawValue });
      continue;
    }

    const validator = schema.validators[canonicalKey];
    const validatedValue = validator ? validator(rawValue) : rawValue;

    if (validatedValue === null || validatedValue === undefined || validatedValue === '') {
      rejectedFields.push({ field: rawKey, reason: 'invalid_value', raw_value: rawValue });
      continue;
    }

    validSlots[canonicalKey] = validatedValue;
  }

  if (category) validSlots.category = category;

  return { category, validSlots, rejectedFields };
}

module.exports = { canonicalize, normalizeCategory, CATEGORY_ALIASES };

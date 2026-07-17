'use strict';

const { getSchemaForCategory } = require('../schema/categorySchemas');

/**
 * computeMissingSlots(state) -> string[]
 *
 * Tính danh sách slot bắt buộc còn thiếu, HOÀN TOÀN bằng code dựa trên
 * schema.required + state.slots hiện có. Không giao việc này cho LLM tự
 * quyết định "đủ hay chưa" — LLM có thể hiểu sai hoặc quên slot đã hỏi.
 *
 * Một slot được coi là "đã có" nếu tồn tại trong state.slots và giá trị
 * không phải null/undefined/chuỗi rỗng. (Giá trị false hợp lệ, vd
 * noise_priority=false nghĩa là khách xác nhận KHÔNG ưu tiên êm.)
 */
function computeMissingSlots(state) {
  const schema = getSchemaForCategory(state.category);
  const required = state.category ? schema.required : ['category'];

  return required.filter((slotName) => {
    if (slotName === 'category') {
      return !state.category;
    }
    const value = state.slots[slotName];
    return value === undefined || value === null || value === '';
  });
}

module.exports = { computeMissingSlots };

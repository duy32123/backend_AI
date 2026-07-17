'use strict';

/**
 * mergeSlots(prevState, canonicalResult) -> newState
 *
 * - prevState: ConversationState hiện tại (xem conversationState.js)
 * - canonicalResult: output của nlu/canonicalize.js cho turn hiện tại
 *   { category, validSlots, rejectedFields }
 *
 * Quy tắc:
 *  - Slot mới (đã qua validate ở bước canonical) ghi đè slot cũ cùng tên —
 *    đây là cách khách hàng "sửa" thông tin đã cho trước đó (vd đổi ngân sách).
 *  - category: cập nhật nếu turn hiện tại xác định được category mới; nếu
 *    không, giữ nguyên category cũ (không reset state giữa chừng).
 *  - rejected_fields: CỘNG DỒN qua các turn, không ghi đè / không xoá —
 *    đây là log để không "âm thầm bỏ field sai".
 *  - turn_count tăng dần, updated_at cập nhật theo thời điểm merge.
 *
 * mergeSlots không tự tính lại missing_slots — việc đó thuộc về
 * state/missingSlots.js để tách rõ trách nhiệm (đúng nguyên tắc
 * "tính missing slot bằng code, không lẫn vào merge").
 */
function mergeSlots(prevState, canonicalResult) {
  const { category, validSlots, rejectedFields } = canonicalResult;

  const mergedSlots = { ...prevState.slots, ...validSlots };
  // slots không nên tự chứa field "category" trùng lặp với state.category
  delete mergedSlots.category;

  const nextCategory = category || prevState.category;

  return {
    ...prevState,
    category: nextCategory,
    slots: mergedSlots,
    rejected_fields: [...prevState.rejected_fields, ...rejectedFields],
    turn_count: prevState.turn_count + 1,
    updated_at: new Date().toISOString(),
  };
}

module.exports = { mergeSlots };

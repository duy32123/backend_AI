'use strict';

// Câu hỏi làm rõ mặc định cho từng slot — có thể thay bằng LLM rephrase sau,
// nhưng luôn phải xuất phát từ đúng slot mà computeMissingSlots() trả về.
const SLOT_QUESTIONS = {
  category: 'Anh/chị đang muốn tìm mua sản phẩm gì ạ (máy lạnh, tủ lạnh...)?',
  budget_max: 'Anh/chị dự định chi trong khoảng ngân sách bao nhiêu ạ?',
  room_area_m2: 'Phòng lắp máy lạnh có diện tích khoảng bao nhiêu m² ạ?',
  installation_location: 'Anh/chị lắp cho phòng ngủ, phòng khách hay khu vực nào ạ?',
  household_size: 'Gia đình mình khoảng mấy người sử dụng ạ?',
};

function defaultQuestionForSlot(slotName) {
  return SLOT_QUESTIONS[slotName] || `Anh/chị cho em xin thêm thông tin về "${slotName}" được không ạ?`;
}

/**
 * chooseNextSlotToAsk(state, missingSlots) -> { slot, isRepeat } | null
 *
 * Ưu tiên hỏi slot CHƯA từng được hỏi (state.asked_slots) — đây là cơ chế
 * chống lặp câu hỏi chính. Chỉ khi mọi slot còn thiếu đều đã từng được hỏi
 * (khách không trả lời hoặc trả lời bị reject) mới quay lại hỏi slot đầu
 * tiên, và đánh dấu isRepeat=true để tầng prompt/UI có thể diễn đạt lại
 * khác đi thay vì lặp y nguyên câu hỏi cũ.
 */
function chooseNextSlotToAsk(state, missingSlots) {
  if (!missingSlots || missingSlots.length === 0) return null;

  const notYetAsked = missingSlots.filter((s) => !state.asked_slots.includes(s));
  if (notYetAsked.length > 0) {
    return { slot: notYetAsked[0], isRepeat: false };
  }
  return { slot: missingSlots[0], isRepeat: true };
}

/**
 * markSlotAsked(state, slotName) -> newState
 * Ghi nhận slot đã được hỏi (idempotent — không thêm trùng lặp vào mảng).
 */
function markSlotAsked(state, slotName) {
  if (state.asked_slots.includes(slotName)) return state;
  return { ...state, asked_slots: [...state.asked_slots, slotName] };
}

/**
 * buildClarifyingQuestion(state, missingSlots) -> { slot, question, isRepeat } | null
 * Hàm tiện ích gộp chooseNextSlotToAsk + sinh câu hỏi hiển thị cho khách.
 */
function buildClarifyingQuestion(state, missingSlots) {
  const choice = chooseNextSlotToAsk(state, missingSlots);
  if (!choice) return null;
  return {
    slot: choice.slot,
    question: defaultQuestionForSlot(choice.slot),
    isRepeat: choice.isRepeat,
  };
}

module.exports = {
  chooseNextSlotToAsk,
  markSlotAsked,
  buildClarifyingQuestion,
  defaultQuestionForSlot,
};

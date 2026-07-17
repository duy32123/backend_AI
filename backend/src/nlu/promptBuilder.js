'use strict';

/**
 * buildNluPrompt(state, missingSlots, userMessage) -> { system, user }
 *
 * Xây prompt gọi LLM (Anthropic API, model claude-sonnet-4-6 theo cấu hình
 * hạ tầng hiện tại) để trích xuất slot thô từ tin nhắn khách hàng.
 *
 * Nguyên tắc bắt buộc trong prompt:
 *  - Luôn truyền previous_state (category + slots đã có) để LLM biết ngữ
 *    cảnh, KHÔNG được hỏi lại hoặc yêu cầu nhắc lại slot đã có giá trị.
 *  - Luôn truyền missing_slots (đã tính bằng code) để LLM biết cần khai
 *    thác thêm field nào — LLM không tự quyết định "đủ hay chưa".
 *  - Chỉ được trích xuất field mới/thay đổi từ đúng nội dung tin nhắn,
 *    không suy diễn, không bịa số liệu.
 *  - Output bắt buộc JSON thuần, để canonicalize.js xử lý tiếp.
 */
function buildNluPrompt(state, missingSlots, userMessage) {
  const previousStatePayload = {
    category: state.category,
    slots: state.slots,
  };

  const system = [
    'Bạn là bộ trích xuất thông tin (NLU) cho trợ lý tư vấn sản phẩm điện máy.',
    'Nhiệm vụ DUY NHẤT: đọc tin nhắn của khách hàng và trả về một JSON object',
    'chứa các field khách hàng vừa cung cấp hoặc cập nhật.',
    '',
    'QUY TẮC BẮT BUỘC:',
    '1. KHÔNG hỏi lại hoặc yêu cầu khách nhắc lại các field đã có trong previous_state.slots.',
    '2. Chỉ trích xuất field có căn cứ rõ ràng trong tin nhắn — không suy diễn, không bịa số liệu.',
    '3. Nếu khách đề cập field đã có nhưng với giá trị khác, ưu tiên cập nhật (khách đang sửa thông tin).',
    '4. Nếu tin nhắn không cung cấp thêm field nào, trả về object rỗng {}.',
    '5. Output CHỈ là JSON object thuần (không markdown, không giải thích thêm).',
    '',
    `missing_slots hiện tại (ưu tiên khai thác nếu khách nhắc tới): ${JSON.stringify(missingSlots)}`,
  ].join('\n');

  const user = JSON.stringify(
    {
      previous_state: previousStatePayload,
      missing_slots: missingSlots,
      customer_message: userMessage,
    },
    null,
    2
  );

  return { system, user };
}

module.exports = { buildNluPrompt };

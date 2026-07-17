'use strict';

const { canonicalize } = require('./nlu/canonicalize');
const { mergeSlots } = require('./state/merge');
const { computeMissingSlots } = require('./state/missingSlots');
const { buildClarifyingQuestion, markSlotAsked } = require('./state/clarification');

/**
 * processTurn(prevState, rawExtraction) -> {
 *   state, missingSlots, clarifyingQuestion, status
 * }
 *
 * Đây là orchestrator cho Module 1 (Slot-filling). `rawExtraction` là kết
 * quả NLU thô — trong production đây là JSON do LLM trả về khi được gọi
 * với prompt từ nlu/promptBuilder.js; trong test/milestone này ta truyền
 * trực tiếp object thô để không phụ thuộc vào việc gọi API thật.
 *
 * status:
 *  - "need_clarification": còn thiếu slot bắt buộc, cần hỏi thêm
 *  - "ready": đủ slot bắt buộc, sẵn sàng cho Module 2 (Retrieval/Filter —
 *    chưa triển khai trong milestone này)
 */
function processTurn(prevState, rawExtraction) {
  const canonicalResult = canonicalize(rawExtraction, prevState.category);
  let newState = mergeSlots(prevState, canonicalResult);

  const missingSlots = computeMissingSlots(newState);
  const clarifyingQuestion = buildClarifyingQuestion(newState, missingSlots);

  if (clarifyingQuestion) {
    newState = markSlotAsked(newState, clarifyingQuestion.slot);
  }

  return {
    state: newState,
    missingSlots,
    clarifyingQuestion,
    status: missingSlots.length > 0 ? 'need_clarification' : 'ready',
  };
}

module.exports = { processTurn };

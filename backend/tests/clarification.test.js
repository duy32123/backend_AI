'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { chooseNextSlotToAsk, markSlotAsked, buildClarifyingQuestion } = require('../src/state/clarification');
const { processTurn } = require('../src/turn');

describe('chống lặp câu hỏi làm rõ', () => {
  test('chọn slot chưa từng hỏi trước, không lặp lại slot đã hỏi', () => {
    let state = createConversationState('sess_1');
    const missing = ['budget_max', 'room_area_m2', 'installation_location'];

    const first = chooseNextSlotToAsk(state, missing);
    expect(first.isRepeat).toBe(false);
    state = markSlotAsked(state, first.slot);

    const second = chooseNextSlotToAsk(state, missing);
    expect(second.slot).not.toBe(first.slot);
    expect(second.isRepeat).toBe(false);
  });

  test('markSlotAsked không thêm trùng lặp vào asked_slots', () => {
    let state = createConversationState('sess_2');
    state = markSlotAsked(state, 'budget_max');
    state = markSlotAsked(state, 'budget_max');
    expect(state.asked_slots).toEqual(['budget_max']);
  });

  test('khi tất cả slot còn thiếu đã từng được hỏi, đánh dấu isRepeat=true thay vì hỏi y hệt không cảnh báo', () => {
    let state = createConversationState('sess_3');
    state = markSlotAsked(state, 'budget_max');
    const choice = chooseNextSlotToAsk(state, ['budget_max']);
    expect(choice.slot).toBe('budget_max');
    expect(choice.isRepeat).toBe(true);
  });

  test('kịch bản hội thoại nhiều lượt: KHÔNG bao giờ hỏi lại slot khách đã trả lời', () => {
    let state = createConversationState('sess_4');
    const askedQuestions = [];

    // Turn 1: khách nói category + budget
    let turn = processTurn(state, { category: 'máy lạnh', budget: '20 triệu' });
    state = turn.state;
    if (turn.clarifyingQuestion) askedQuestions.push(turn.clarifyingQuestion.slot);
    expect(turn.status).toBe('need_clarification');
    // Không được hỏi lại budget_max vì đã có
    expect(askedQuestions).not.toContain('budget_max');

    // Turn 2: khách trả lời đúng slot vừa được hỏi (room_area_m2), theo giả lập NLU
    const slotJustAsked = turn.clarifyingQuestion.slot;
    const answerMap = { room_area_m2: { area: '18m2' }, installation_location: { location: 'phòng ngủ' } };
    turn = processTurn(state, answerMap[slotJustAsked] || {});
    state = turn.state;
    if (turn.clarifyingQuestion) askedQuestions.push(turn.clarifyingQuestion.slot);

    // Slot vừa trả lời không được hỏi lại ở các turn sau
    expect(state.slots[slotJustAsked]).toBeDefined();
    expect(askedQuestions.filter((s) => s === slotJustAsked)).toHaveLength(1);

    // Turn 3: trả lời nốt slot còn lại
    const remainingSlot = turn.clarifyingQuestion ? turn.clarifyingQuestion.slot : null;
    if (remainingSlot) {
      turn = processTurn(state, answerMap[remainingSlot] || {});
      state = turn.state;
    }

    expect(turn.status).toBe('ready');
    expect(turn.missingSlots).toEqual([]);

    // Mỗi slot chỉ xuất hiện đúng 1 lần trong toàn bộ danh sách câu hỏi đã hỏi
    const counts = askedQuestions.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
    Object.values(counts).forEach((c) => expect(c).toBe(1));
  });

  test('buildClarifyingQuestion trả về null khi không còn slot thiếu', () => {
    const state = createConversationState('sess_5');
    expect(buildClarifyingQuestion(state, [])).toBeNull();
  });
});

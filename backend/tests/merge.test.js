'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { mergeSlots } = require('../src/state/merge');
const { canonicalize } = require('../src/nlu/canonicalize');

describe('mergeSlots', () => {
  test('merge slot mới vào state rỗng, tăng turn_count', () => {
    const state = createConversationState('sess_1');
    const canonicalResult = canonicalize({ category: 'máy lạnh', budget: '20 triệu' });

    const newState = mergeSlots(state, canonicalResult);

    expect(newState.category).toBe('may_lanh');
    expect(newState.slots.budget_max).toBe(20_000_000);
    expect(newState.turn_count).toBe(1);
  });

  test('slot mới ở turn sau KHÔNG xoá slot cũ đã có (cộng dồn nhiều lượt)', () => {
    let state = createConversationState('sess_2');
    state = mergeSlots(state, canonicalize({ category: 'máy lạnh', budget: '20 triệu' }, state.category));
    state = mergeSlots(state, canonicalize({ area: '18m2' }, state.category));

    expect(state.slots.budget_max).toBe(20_000_000);
    expect(state.slots.room_area_m2).toBe(18);
    expect(state.turn_count).toBe(2);
  });

  test('khách sửa lại giá trị slot đã có -> ghi đè bằng giá trị mới', () => {
    let state = createConversationState('sess_3');
    state = mergeSlots(state, canonicalize({ category: 'máy lạnh', budget: '20 triệu' }, state.category));
    state = mergeSlots(state, canonicalize({ budget: '15 triệu' }, state.category));

    expect(state.slots.budget_max).toBe(15_000_000);
  });

  test('rejected_fields cộng dồn qua nhiều turn, không bị ghi đè mất', () => {
    let state = createConversationState('sess_4');
    state = mergeSlots(
      state,
      canonicalize({ category: 'máy lạnh', mau_sac_la: 'đỏ' }, state.category)
    );
    state = mergeSlots(
      state,
      canonicalize({ budget: 'không rõ số' }, state.category)
    );

    expect(state.rejected_fields).toHaveLength(2);
    expect(state.rejected_fields[0].field).toBe('mau_sac_la');
    expect(state.rejected_fields[1].field).toBe('budget');
  });

  test('state.slots không chứa field "category" trùng lặp', () => {
    const state = createConversationState('sess_5');
    const newState = mergeSlots(state, canonicalize({ category: 'tủ lạnh' }));
    expect(newState.slots.category).toBeUndefined();
    expect(newState.category).toBe('tu_lanh');
  });
});

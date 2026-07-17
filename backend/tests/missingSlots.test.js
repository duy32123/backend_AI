'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { computeMissingSlots } = require('../src/state/missingSlots');
const { mergeSlots } = require('../src/state/merge');
const { canonicalize } = require('../src/nlu/canonicalize');

describe('computeMissingSlots', () => {
  test('chưa biết category -> missing = ["category"]', () => {
    const state = createConversationState('sess_1');
    expect(computeMissingSlots(state)).toEqual(['category']);
  });

  test('máy lạnh: thiếu đủ 3 slot bắt buộc còn lại sau khi biết category', () => {
    let state = createConversationState('sess_2');
    state = mergeSlots(state, canonicalize({ category: 'máy lạnh' }, state.category));

    expect(computeMissingSlots(state)).toEqual(
      expect.arrayContaining(['budget_max', 'room_area_m2', 'installation_location'])
    );
    expect(computeMissingSlots(state)).toHaveLength(3);
  });

  test('đủ dần từng slot -> missing giảm dần tương ứng', () => {
    let state = createConversationState('sess_3');
    state = mergeSlots(state, canonicalize({ category: 'máy lạnh', budget: '20 triệu' }, state.category));
    expect(computeMissingSlots(state)).toEqual(
      expect.arrayContaining(['room_area_m2', 'installation_location'])
    );
    expect(computeMissingSlots(state)).toHaveLength(2);

    state = mergeSlots(state, canonicalize({ area: '18m2' }, state.category));
    expect(computeMissingSlots(state)).toEqual(['installation_location']);

    state = mergeSlots(state, canonicalize({ location: 'phòng ngủ' }, state.category));
    expect(computeMissingSlots(state)).toEqual([]);
  });

  test('tủ lạnh: bộ slot bắt buộc khác với máy lạnh', () => {
    let state = createConversationState('sess_4');
    state = mergeSlots(state, canonicalize({ category: 'tủ lạnh', budget: '15 triệu', household: '4' }, state.category));
    expect(computeMissingSlots(state)).toEqual([]);
  });

  test('field bị reject (invalid_value) KHÔNG được tính là đã có -> vẫn nằm trong missing_slots', () => {
    let state = createConversationState('sess_5');
    state = mergeSlots(
      state,
      canonicalize({ category: 'máy lạnh', budget: 'nhiều tiền lắm' }, state.category)
    );
    expect(computeMissingSlots(state)).toEqual(
      expect.arrayContaining(['budget_max'])
    );
  });
});

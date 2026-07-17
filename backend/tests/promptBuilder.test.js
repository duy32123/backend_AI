'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { buildNluPrompt } = require('../src/nlu/promptBuilder');

describe('buildNluPrompt', () => {
  test('prompt chứa previous_state và missing_slots', () => {
    const state = createConversationState('sess_1');
    state.category = 'may_lanh';
    state.slots = { budget_max: 20_000_000 };

    const { system, user } = buildNluPrompt(state, ['room_area_m2', 'installation_location'], 'lắp cho phòng ngủ');

    const userPayload = JSON.parse(user);
    expect(userPayload.previous_state.category).toBe('may_lanh');
    expect(userPayload.previous_state.slots.budget_max).toBe(20_000_000);
    expect(userPayload.missing_slots).toEqual(['room_area_m2', 'installation_location']);
    expect(userPayload.customer_message).toBe('lắp cho phòng ngủ');

    expect(system).toMatch(/KHÔNG hỏi lại/);
    expect(system).toMatch(/không suy diễn, không bịa số liệu/);
  });
});

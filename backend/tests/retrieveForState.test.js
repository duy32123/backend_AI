'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { processTurn } = require('../src/turn');
const { retrieveForState } = require('../src/retrieveForState');
const { clearCatalogCache } = require('../src/data/catalogStore');

describe('retrieveForState — nối Module 1 (slot-filling) với Module 2 (retrieval) trên catalog thật', () => {
  afterEach(() => clearCatalogCache());

  test('state chưa đủ slot -> status not_ready, chưa đụng tới catalog', () => {
    const state = createConversationState('sess_1');
    const result = retrieveForState(state);
    expect(result.status).toBe('not_ready');
    expect(result.missing_slots).toEqual(['category']);
  });

  test('kịch bản khách mua máy lạnh dưới 20 triệu, phòng 18m² -> trả về sản phẩm thật từ catalog', () => {
    let state = createConversationState('sess_2');
    let turn = processTurn(state, {
      category: 'máy lạnh',
      budget: '20 triệu',
      area: '18m2',
      location: 'phòng ngủ',
    });
    state = turn.state;
    expect(turn.status).toBe('ready');

    const result = retrieveForState(state);
    expect(['ok', 'relaxed']).toContain(result.status);
    expect(result.products.length).toBeGreaterThan(0);

    // Mọi sản phẩm trả về phải thật sự nằm trong catalog (có model_code/id thật),
    // không phải dữ liệu bịa ra.
    result.products.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.category).toBe('may_lanh');
    });

    if (result.status === 'ok') {
      result.products.forEach((p) => {
        expect(p.effective_price).toBeLessThanOrEqual(20_000_000);
      });
    }
  });

  test('ngân sách quá thấp phi thực tế -> hệ thống báo rõ no_results thay vì bịa sản phẩm', () => {
    let state = createConversationState('sess_3');
    let turn = processTurn(state, {
      category: 'máy lạnh',
      budget: '100000', // parse ra 100.000đ - dưới ngưỡng nhận diện số tiền hợp lệ thực ra sẽ bị reject
      area: '18m2',
      location: 'phòng ngủ',
    });
    state = turn.state;

    // Ép trực tiếp budget cực thấp vào state để kiểm tra nhánh no_results của Module 2
    // (bỏ qua qua NLU vì "100000" dưới 5 chữ số bị canonicalize từ chối ở Module 1).
    state = { ...state, slots: { ...state.slots, budget_max: 500_000 } };

    const result = retrieveForState(state);
    expect(result.status).toBe('no_results');
    expect(result.products).toEqual([]);
    expect(result.message).toBeTruthy();
  });
});

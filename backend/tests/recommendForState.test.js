'use strict';

const { createConversationState } = require('../src/state/conversationState');
const { processTurn } = require('../src/turn');
const { recommendForState } = require('../src/recommendForState');
const { clearCatalogCache } = require('../src/data/catalogStore');

describe('recommendForState — integration Excel thật: state → retrieval/filter → ranking', () => {
  afterEach(() => clearCatalogCache());

  test('trả Top N đúng số lượng trên catalog thật và deterministic', () => {
    let state = createConversationState('sess_rank_real');
    state = processTurn(state, {
      category: 'máy lạnh',
      budget: '20 triệu',
      area: '18m2',
      location: 'phòng ngủ',
      noise_priority: true,
    }).state;

    const first = recommendForState(state, { topN: 3 });
    const second = recommendForState(state, { topN: 3 });

    expect(['ok', 'relaxed']).toContain(first.status);
    expect(first.results).toHaveLength(Math.min(3, first.retrieval.products.length));
    expect(first).toEqual(second);
    first.results.forEach((r, idx) => {
      expect(r.rank).toBe(idx + 1);
      expect(r.source).toEqual(expect.objectContaining({ category: 'may_lanh' }));
    });
  });
});

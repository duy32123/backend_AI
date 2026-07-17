'use strict';

const { rankProducts } = require('../src/ranking/rankProducts');

function ac(overrides) {
  return {
    id: overrides.id,
    model_code: overrides.id,
    category: 'may_lanh',
    effective_price: overrides.price,
    room_area_range: overrides.area || null,
    noise_db: overrides.noise || null,
    power_saving_tech: overrides.power || null,
    loai_may: overrides.loai_may || null,
  };
}

describe('rankProducts — rule-based deterministic ranking', () => {
  test('chọn đúng Top N mặc định Top 3 và gắn source record gốc', () => {
    const result = rankProducts({ status: 'ok', products: [
      ac({ id: 'AC-1', price: 10_000_000, area: { min: 15, max: 20 }, noise: { min: 24, max: 40 } }),
      ac({ id: 'AC-2', price: 11_000_000, area: { min: 15, max: 20 }, noise: { min: 26, max: 42 } }),
      ac({ id: 'AC-3', price: 12_000_000, area: { min: 15, max: 20 }, noise: { min: 28, max: 43 } }),
      ac({ id: 'AC-4', price: 13_000_000, area: { min: 15, max: 20 }, noise: { min: 35, max: 45 } }),
    ] }, { category: 'may_lanh', slots: { budget_max: 20_000_000, room_area_m2: 18, installation_location: 'phòng ngủ' } });

    expect(result.results).toHaveLength(3);
    expect(result.results[0]).toMatchObject({ rank: 1, product_id: 'AC-1', model_code: 'AC-1' });
    expect(result.results[0].source).toEqual(expect.objectContaining({ id: 'AC-1' }));
  });

  test('điểm giảm khi lệch nhu cầu diện tích và độ ồn', () => {
    const good = ac({ id: 'GOOD', price: 10_000_000, area: { min: 15, max: 20 }, noise: { min: 24, max: 40 } });
    const bad = ac({ id: 'BAD', price: 10_000_000, area: { min: 30, max: 40 }, noise: { min: 44, max: 55 } });
    const result = rankProducts({ status: 'relaxed', relaxed_steps: ['dropped_room_area_constraint'], products: [bad, good] }, { category: 'may_lanh', slots: { budget_max: 12_000_000, room_area_m2: 18, installation_location: 'phòng ngủ' } });

    expect(result.results[0].product_id).toBe('GOOD');
    expect(result.results[0].total_score).toBeGreaterThan(result.results[1].total_score);
    expect(result.results[1].tradeoffs.join(' ')).toMatch(/dropped_room_area_constraint/);
  });

  test('field null không bị suy diễn, được ghi missing_data và điểm trung lập', () => {
    const result = rankProducts({ status: 'ok', products: [ac({ id: 'NULLS', price: 9_000_000 })] }, { category: 'may_lanh', slots: { budget_max: 12_000_000, room_area_m2: 18, installation_location: 'phòng ngủ', power_saving_priority: true } });
    const top = result.results[0];

    expect(top.missing_data).toEqual(expect.arrayContaining(['room_area_range', 'noise_db', 'power_saving_tech']));
    expect(top.score_breakdown.room_area.score).toBe(50);
    expect(top.score_breakdown.noise.score).toBe(50);
    expect(top.score_breakdown.power_saving.score).toBe(50);
  });

  test('tie-break ổn định theo giá rồi product_id và kết quả deterministic', () => {
    const products = [
      ac({ id: 'B', price: 10_000_000, area: { min: 15, max: 20 } }),
      ac({ id: 'A', price: 10_000_000, area: { min: 15, max: 20 } }),
      ac({ id: 'C', price: 9_000_000, area: { min: 15, max: 20 } }),
    ];
    const args = [{ status: 'ok', products }, { category: 'may_lanh', slots: { budget_max: 12_000_000, room_area_m2: 18 } }];
    const first = rankProducts(...args);
    const second = rankProducts(...args);

    expect(first.results.map((r) => r.product_id)).toEqual(['C', 'A', 'B']);
    expect(second).toEqual(first);
  });

  test('không mutate catalog đầu vào', () => {
    const products = [ac({ id: 'IMMUTABLE', price: 10_000_000, area: { min: 15, max: 20 } })];
    const before = JSON.stringify(products);
    rankProducts({ status: 'ok', products }, { category: 'may_lanh', slots: { budget_max: 12_000_000, room_area_m2: 18 } });
    expect(JSON.stringify(products)).toBe(before);
  });

  test('xử lý not_ready, no_results và danh sách sản phẩm rỗng', () => {
    expect(rankProducts({ status: 'not_ready', missing_slots: ['budget_max'], products: [] }, {}).status).toBe('not_ready');
    expect(rankProducts({ status: 'no_results', products: [], message: 'none' }, {}).status).toBe('no_results');
    expect(rankProducts({ status: 'ok', products: [] }, {}).status).toBe('no_results');
  });
});

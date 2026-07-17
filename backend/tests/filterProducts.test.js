'use strict';

const { filterProducts } = require('../src/retrieval/filterProducts');

function mockAC({ id, price, areaMin, areaMax }) {
  return {
    id,
    category: 'may_lanh',
    effective_price: price,
    room_area_range: areaMin == null ? null : { min: areaMin, max: areaMax },
  };
}

function mockFridge({ id, price, hhMin, hhMax }) {
  return {
    id,
    category: 'tu_lanh',
    effective_price: price,
    household_range: hhMin == null ? null : { min: hhMin, max: hhMax },
  };
}

describe('filterProducts — máy lạnh', () => {
  const products = [
    mockAC({ id: 'AC-1', price: 12_000_000, areaMin: 15, areaMax: 20 }),
    mockAC({ id: 'AC-2', price: 18_000_000, areaMin: 20, areaMax: 30 }),
    mockAC({ id: 'AC-3', price: 25_000_000, areaMin: 15, areaMax: 20 }), // vượt ngân sách
    mockAC({ id: 'AC-4', price: 10_000_000, areaMin: 30, areaMax: 40 }), // sai diện tích
    mockAC({ id: 'AC-5', price: 9_000_000, areaMin: null, areaMax: null }), // thiếu dữ liệu diện tích
  ];

  test('strict match: đúng cả ngân sách và diện tích -> status ok', () => {
    const result = filterProducts('may_lanh', { budget_max: 20_000_000, room_area_m2: 18 }, products);
    expect(result.status).toBe('ok');
    expect(result.relaxed_steps).toEqual([]);
    expect(result.products.map((p) => p.id)).toEqual(['AC-1']);
  });

  test('không có sản phẩm khớp diện tích -> tự động nới bỏ ràng buộc diện tích', () => {
    const result = filterProducts('may_lanh', { budget_max: 11_000_000, room_area_m2: 18 }, products);
    // Chỉ AC-5 (9tr, không rõ diện tích) nằm trong ngân sách nhưng bị loại ở strict vì thiếu dữ liệu diện tích
    expect(result.status).toBe('relaxed');
    expect(result.relaxed_steps).toEqual(['dropped_room_area_constraint']);
    expect(result.products.map((p) => p.id)).toContain('AC-5');
  });

  test('vẫn 0 kết quả sau khi bỏ ràng buộc diện tích -> nới thêm ngân sách 15%', () => {
    // Ngân sách 10tr: không sản phẩm nào effective_price <= 10tr trừ AC-5 (9tr, đã match ở bước trước)
    // Dựng case ngân sách thấp hơn AC-5 để buộc phải nới ngân sách
    const result = filterProducts('may_lanh', { budget_max: 8_500_000, room_area_m2: 18 }, products);
    expect(result.status).toBe('relaxed');
    expect(result.relaxed_steps).toEqual(['dropped_room_area_constraint', 'increased_budget_15pct']);
    expect(result.products.map((p) => p.id)).toContain('AC-5'); // 9tr <= 8.5tr*1.15
  });

  test('không còn sản phẩm nào dù đã nới hết -> status no_results, có message rõ ràng, không bịa sản phẩm', () => {
    const result = filterProducts('may_lanh', { budget_max: 1_000_000, room_area_m2: 18 }, products);
    expect(result.status).toBe('no_results');
    expect(result.products).toEqual([]);
    expect(result.message).toMatch(/chưa (tìm thấy|có)/i);
  });

  test('sản phẩm không có effective_price (null) luôn bị loại, không được đưa vào tư vấn', () => {
    const productsWithNullPrice = [mockAC({ id: 'AC-NO-PRICE', price: null, areaMin: 15, areaMax: 20 })];
    const result = filterProducts('may_lanh', { budget_max: 100_000_000, room_area_m2: 18 }, productsWithNullPrice);
    expect(result.status).toBe('no_results');
  });
});

describe('filterProducts — tủ lạnh', () => {
  const products = [
    mockFridge({ id: 'FR-1', price: 15_000_000, hhMin: 3, hhMax: 4 }),
    mockFridge({ id: 'FR-2', price: 22_000_000, hhMin: 4, hhMax: 5 }),
    mockFridge({ id: 'FR-3', price: 12_000_000, hhMin: null, hhMax: null }),
  ];

  test('strict match theo số người sử dụng + ngân sách', () => {
    const result = filterProducts('tu_lanh', { budget_max: 16_000_000, household_size: 4 }, products);
    expect(result.status).toBe('ok');
    expect(result.products.map((p) => p.id)).toEqual(['FR-1']);
  });

  test('không khớp household -> nới bỏ ràng buộc household trước khi nới ngân sách', () => {
    const result = filterProducts('tu_lanh', { budget_max: 13_000_000, household_size: 4 }, products);
    expect(result.status).toBe('relaxed');
    expect(result.relaxed_steps).toEqual(['dropped_household_constraint']);
    expect(result.products.map((p) => p.id)).toEqual(['FR-3']);
  });
});

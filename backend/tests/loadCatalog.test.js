'use strict';

const { loadCatalogFromExcel } = require('../src/data/loadCatalog');

describe('loadCatalogFromExcel (dữ liệu thật từ Spec_cate_gia.xlsx)', () => {
  let catalog;

  beforeAll(() => {
    catalog = loadCatalogFromExcel();
  });

  test('nạp được cả 2 category ưu tiên với số lượng sản phẩm hợp lý', () => {
    expect(catalog.may_lanh.length).toBeGreaterThan(500);
    expect(catalog.tu_lanh.length).toBeGreaterThan(500);
  });

  test('mỗi sản phẩm máy lạnh có id/model_code và effective_price hoặc null (không bịa giá)', () => {
    catalog.may_lanh.slice(0, 50).forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.category).toBe('may_lanh');
      expect(typeof p.effective_price === 'number' || p.effective_price === null).toBe(true);
    });
  });

  test('phần lớn sản phẩm máy lạnh parse được room_area_range (dữ liệu thật đủ tốt để filter)', () => {
    const withArea = catalog.may_lanh.filter((p) => p.room_area_range !== null);
    expect(withArea.length / catalog.may_lanh.length).toBeGreaterThan(0.5);

    const sample = withArea[0];
    expect(typeof sample.room_area_range.min).toBe('number');
  });

  test('phần lớn sản phẩm tủ lạnh parse được household_range', () => {
    const withHousehold = catalog.tu_lanh.filter((p) => p.household_range !== null);
    expect(withHousehold.length / catalog.tu_lanh.length).toBeGreaterThan(0.5);
  });

  test('giá khuyến mãi thiếu ở nhiều sản phẩm nhưng effective_price vẫn fallback về giá gốc đúng', () => {
    const noPromo = catalog.tu_lanh.find((p) => p.promo_price === null && p.original_price !== null);
    expect(noPromo).toBeDefined();
    expect(noPromo.effective_price).toBe(noPromo.original_price);
  });
});

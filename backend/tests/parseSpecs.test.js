'use strict';

const { parseRangeGeneric, parseNoiseDb, parseCapacityLiters, effectivePrice, inRange } = require('../src/data/parseSpecs');

describe('parseRangeGeneric', () => {
  test('"Từ 30 - 40m² (từ 80 đến 120m³)" -> {min:30, max:40}', () => {
    expect(parseRangeGeneric('Từ 30 - 40m² (từ 80 đến 120m³)')).toEqual({ min: 30, max: 40 });
  });

  test('"Dưới 15m² (từ 30 đến 45m³)" -> {min:0, max:15}', () => {
    expect(parseRangeGeneric('Dưới 15m² (từ 30 đến 45m³)')).toEqual({ min: 0, max: 15 });
  });

  test('"Trên 5 người" -> {min:5, max:null}', () => {
    expect(parseRangeGeneric('Trên 5 người')).toEqual({ min: 5, max: null });
  });

  test('"3 - 4 người" -> {min:3, max:4}', () => {
    expect(parseRangeGeneric('3 - 4 người')).toEqual({ min: 3, max: 4 });
  });

  test('"2 cánh" (một số duy nhất) -> {min:2, max:2}', () => {
    expect(parseRangeGeneric('2 cánh')).toEqual({ min: 2, max: 2 });
  });

  test('dữ liệu không xác định -> null, không suy diễn', () => {
    expect(parseRangeGeneric('Không')).toBeNull();
    expect(parseRangeGeneric('Đang cập nhật')).toBeNull();
    expect(parseRangeGeneric(null)).toBeNull();
    expect(parseRangeGeneric(undefined)).toBeNull();
  });
});

describe('parseNoiseDb', () => {
  test('"Dàn lạnh: 45/34/29 dB - Dàn nóng: 51 dB" -> min 29, max 51', () => {
    expect(parseNoiseDb('Dàn lạnh: 45/34/29 dB - Dàn nóng: 51 dB')).toEqual({ min: 29, max: 51 });
  });

  test('"47/41 dB" -> min 41, max 47', () => {
    expect(parseNoiseDb('47/41 dB')).toEqual({ min: 41, max: 47 });
  });

  test('không có số -> null', () => {
    expect(parseNoiseDb('Không')).toBeNull();
  });
});

describe('parseCapacityLiters', () => {
  test('"313 lít" -> 313', () => {
    expect(parseCapacityLiters('313 lít')).toBe(313);
  });
  test('giá trị không hợp lệ -> null', () => {
    expect(parseCapacityLiters(null)).toBeNull();
  });
});

describe('effectivePrice', () => {
  test('ưu tiên giá khuyến mãi nếu có', () => {
    expect(effectivePrice(20_000_000, 18_500_000)).toBe(18_500_000);
  });
  test('fallback giá gốc nếu không có khuyến mãi', () => {
    expect(effectivePrice(20_000_000, null)).toBe(20_000_000);
  });
  test('cả hai đều thiếu -> null (không bịa giá)', () => {
    expect(effectivePrice(null, null)).toBeNull();
  });
});

describe('inRange', () => {
  test('trong khoảng đóng', () => {
    expect(inRange(18, { min: 15, max: 20 })).toBe(true);
    expect(inRange(25, { min: 15, max: 20 })).toBe(false);
  });
  test('khoảng mở (max null)', () => {
    expect(inRange(100, { min: 5, max: null })).toBe(true);
  });
  test('không có range -> null (không kết luận được)', () => {
    expect(inRange(18, null)).toBeNull();
  });
});

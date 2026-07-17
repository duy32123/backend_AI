'use strict';

const { canonicalize, normalizeCategory } = require('../src/nlu/canonicalize');

describe('canonicalize', () => {
  test('chuẩn hoá category tiếng Việt tự nhiên về mã canonical', () => {
    expect(normalizeCategory('Máy lạnh')).toBe('may_lanh');
    expect(normalizeCategory('điều hòa')).toBe('may_lanh');
    expect(normalizeCategory('Tủ lạnh')).toBe('tu_lanh');
    expect(normalizeCategory('không xác định !!!')).toBeNull();
  });

  test('chuẩn hoá field "location" thành "installation_location"', () => {
    const { validSlots, rejectedFields } = canonicalize({
      category: 'máy lạnh',
      location: 'phòng ngủ',
    });

    expect(validSlots.installation_location).toBe('phòng ngủ');
    expect(validSlots.location).toBeUndefined();
    expect(rejectedFields).toHaveLength(0);
  });

  test('chuẩn hoá các alias khác của location (vị trí lắp, nơi lắp đặt)', () => {
    const r1 = canonicalize({ category: 'may_lanh', 'vị trí lắp': 'phòng khách' });
    expect(r1.validSlots.installation_location).toBe('phòng khách');

    const r2 = canonicalize({ category: 'may_lanh', 'nơi lắp đặt': 'phòng bếp' });
    expect(r2.validSlots.installation_location).toBe('phòng bếp');
  });

  test('parse ngân sách dạng tiếng Việt ("20 triệu") thành số VND', () => {
    const { validSlots } = canonicalize({ category: 'may_lanh', budget: '20 triệu' });
    expect(validSlots.budget_max).toBe(20_000_000);
  });

  test('parse diện tích dạng "18m2"', () => {
    const { validSlots } = canonicalize({ category: 'may_lanh', area: '18m2' });
    expect(validSlots.room_area_m2).toBe(18);
  });

  test('KHÔNG âm thầm bỏ field không nhận diện được — phải xuất hiện trong rejected_fields', () => {
    const { validSlots, rejectedFields } = canonicalize({
      category: 'may_lanh',
      color_preference_unknown_field: 'màu bạc',
    });

    expect(validSlots.color_preference_unknown_field).toBeUndefined();
    expect(rejectedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'color_preference_unknown_field',
          reason: 'unrecognized_field',
          raw_value: 'màu bạc',
        }),
      ])
    );
  });

  test('KHÔNG âm thầm bỏ field có giá trị sai kiểu — phải xuất hiện trong rejected_fields với lý do invalid_value', () => {
    const { validSlots, rejectedFields } = canonicalize({
      category: 'may_lanh',
      budget: 'nhiều tiền lắm', // không parse được thành số
    });

    expect(validSlots.budget_max).toBeUndefined();
    expect(rejectedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'budget', reason: 'invalid_value', raw_value: 'nhiều tiền lắm' }),
      ])
    );
  });

  test('category không nhận diện được cũng được giữ lại trong rejected_fields, không mất im lặng', () => {
    const { category, rejectedFields } = canonicalize({ category: '???', budget: '20 triệu' });
    expect(category).toBeNull();
    expect(rejectedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'category', reason: 'unrecognized_category', raw_value: '???' }),
      ])
    );
  });

  test('giữ nguyên currentCategory nếu turn hiện tại không nhắc lại category', () => {
    const { category, validSlots } = canonicalize({ budget: '15 triệu' }, 'tu_lanh');
    expect(category).toBe('tu_lanh');
    expect(validSlots.budget_max).toBe(15_000_000);
  });
});

'use strict';

const path = require('path');
const XLSX = require('xlsx');
const { parseRangeGeneric, parseNoiseDb, parseCapacityLiters, effectivePrice } = require('./parseSpecs');

const DEFAULT_XLSX_PATH = path.join(__dirname, '..', '..', 'data', 'Spec_cate_gia.xlsx');

const SHEET_NAMES = {
  may_lanh: 'Máy lạnh',
  tu_lanh: 'Tủ Lạnh',
};

function baseProductFields(row, category) {
  const original = typeof row['giá gốc'] === 'number' ? row['giá gốc'] : null;
  const promo = typeof row['giá khuyến mãi'] === 'number' ? row['giá khuyến mãi'] : null;

  return {
    id: String(row.model_code),
    model_code: String(row.model_code),
    sku: row.sku != null ? String(row.sku) : null,
    productidweb: row.productidweb != null ? String(row.productidweb) : null,
    category,
    brand: row.brand || null,
    brand_id: row.brand_id != null ? String(row.brand_id) : null,
    original_price: original,
    promo_price: promo,
    effective_price: effectivePrice(original, promo),
    promo_gift: row['khuyến mãi quà'] || null,
  };
}

function normalizeMayLanhRow(row) {
  return {
    ...baseProductFields(row, 'may_lanh'),
    room_area_range: parseRangeGeneric(row['Phạm vi sử dụng']),
    noise_db: parseNoiseDb(row['Độ ồn']),
    loai_may: row['Loại máy'] || null,
    energy_label: row['Nhãn năng lượng'] || null,
    power_saving_tech: row['Công nghệ tiết kiệm điện'] || null,
    utilities: row['Tiện ích'] || null,
    made_in: row['Sản xuất tại'] || null,
    _raw: row,
  };
}

function normalizeTuLanhRow(row) {
  const doorRange = parseRangeGeneric(row['Số cửa']);
  return {
    ...baseProductFields(row, 'tu_lanh'),
    household_range: parseRangeGeneric(row['Số người sử dụng']),
    capacity_total_liters: parseCapacityLiters(row['Dung tích tổng']),
    door_count: doorRange ? doorRange.min : null,
    kieu_dang: row['Kiểu dáng'] || null,
    power_saving_tech: row['Công nghệ tiết kiệm điện'] || null,
    made_in: row['Sản xuất tại'] || null,
    _raw: row,
  };
}

const ROW_NORMALIZERS = {
  may_lanh: normalizeMayLanhRow,
  tu_lanh: normalizeTuLanhRow,
};

/**
 * loadCatalogFromExcel(filePath?) -> { may_lanh: Product[], tu_lanh: Product[] }
 *
 * Đọc trực tiếp từ Spec_cate_gia.xlsx (không copy sang định dạng khác ở
 * bước này để giữ đúng nguồn dữ liệu gốc), chuẩn hoá thành các field có
 * cấu trúc dùng để filter (Module 2). Sản phẩm thiếu model_code bị bỏ qua
 * vì không có định danh để trích dẫn nguồn dữ liệu sau này (Module 4).
 */
function loadCatalogFromExcel(filePath = DEFAULT_XLSX_PATH) {
  const workbook = XLSX.readFile(filePath);
  const catalog = {};

  for (const [category, sheetName] of Object.entries(SHEET_NAMES)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      catalog[category] = [];
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const normalize = ROW_NORMALIZERS[category];
    catalog[category] = rows.filter((r) => r.model_code != null).map(normalize);
  }

  return catalog;
}

module.exports = { loadCatalogFromExcel, DEFAULT_XLSX_PATH, SHEET_NAMES };

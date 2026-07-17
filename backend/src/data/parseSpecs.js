'use strict';

/**
 * parseSpecs.js — các hàm parse thông số thô (tiếng Việt, đơn vị lẫn trong
 * chuỗi, dữ liệu không đồng nhất) từ Spec_cate_gia.xlsx thành giá trị có
 * cấu trúc để filter được bằng code.
 *
 * Dữ liệu thật rất lộn xộn (đúng như cảnh báo "anti-pattern" của đề bài):
 *  - "Từ 30 - 40m² (từ 80 đến 120m³)"  (máy lạnh — diện tích phòng)
 *  - "Dưới 15m² (từ 30 đến 45m³)"
 *  - "Không" / "Đang cập nhật"          (không có dữ liệu)
 *  - "3 - 4 người" / "Trên 5 người"     (tủ lạnh — số người sử dụng)
 *  - "Dàn lạnh: 45/34/29 dB - Dàn nóng: 51 dB"  (độ ồn — không đồng nhất)
 *
 * Nguyên tắc: parse KHÔNG được -> trả về null, KHÔNG suy diễn hay đoán giá
 * trị mặc định. Caller (loadCatalog/filterProducts) phải tự quyết định xử
 * lý thế nào với sản phẩm thiếu dữ liệu spec (thường là: không dùng spec đó
 * để loại sản phẩm, chỉ dùng để loại khi có dữ liệu và không khớp).
 */

const NO_DATA_PATTERNS = [/^không$/i, /cập nhật/i, /^n\/?a$/i];

function isNoDataText(text) {
  const s = text.trim();
  return NO_DATA_PATTERNS.some((re) => re.test(s));
}

/**
 * parseRangeGeneric("Từ 30 - 40m² (từ 80 đến 120m³)") -> { min: 30, max: 40 }
 * parseRangeGeneric("Dưới 15m² (...)")                -> { min: 0,  max: 15 }
 * parseRangeGeneric("Trên 5 người")                   -> { min: 5,  max: null }
 * parseRangeGeneric("2 cánh")                         -> { min: 2,  max: 2 }
 * parseRangeGeneric("Không" | "Đang cập nhật" | null) -> null
 *
 * Chiến lược: cắt bỏ phần trong ngoặc đơn (thường là quy đổi đơn vị phụ,
 * vd m³ đi kèm m²) rồi trích các số trong phần còn lại.
 */
function parseRangeGeneric(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || isNoDataText(trimmed)) return null;

  const mainText = trimmed.split('(')[0];
  const lower = mainText.toLowerCase();
  const numbers = (mainText.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => parseFloat(n.replace(',', '.')));

  if (numbers.length === 0) return null;
  if (lower.includes('dưới')) return { min: 0, max: numbers[0] };
  if (lower.includes('trên')) return { min: numbers[0], max: null };
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: numbers[0], max: numbers[1] };
}

/**
 * parseNoiseDb("Dàn lạnh: 45/34/29 dB - Dàn nóng: 51 dB") -> { min: 29, max: 51 }
 * parseNoiseDb("47/41 dB") -> { min: 41, max: 47 }
 * Lấy toàn bộ số dB xuất hiện trong chuỗi (không phân biệt dàn lạnh/nóng vì
 * format không đồng nhất giữa các sản phẩm), min = mức êm nhất, max = mức ồn nhất.
 */
function parseNoiseDb(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || isNoDataText(trimmed)) return null;

  const numbers = (trimmed.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => parseFloat(n.replace(',', '.')));
  if (numbers.length === 0) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

/**
 * parseCapacityLiters("313 lít") -> 313
 */
function parseCapacityLiters(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return parseFloat(m[0].replace(',', '.'));
}

/**
 * effectivePrice(row) -> số VND dùng để filter/hiển thị.
 * Ưu tiên "giá khuyến mãi" nếu có (khác null/undefined/0), fallback "giá gốc".
 * Không bịa giá nếu cả hai đều thiếu -> trả về null.
 */
function effectivePrice(giaGoc, giaKhuyenMai) {
  if (typeof giaKhuyenMai === 'number' && giaKhuyenMai > 0) return giaKhuyenMai;
  if (typeof giaGoc === 'number' && giaGoc > 0) return giaGoc;
  return null;
}

/**
 * inRange(value, range) — range dạng { min, max } với max có thể null (mở, không giới hạn trên).
 */
function inRange(value, range) {
  if (!range) return null; // không có dữ liệu -> không kết luận được
  if (value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
}

module.exports = {
  parseRangeGeneric,
  parseNoiseDb,
  parseCapacityLiters,
  effectivePrice,
  inRange,
  isNoDataText,
};

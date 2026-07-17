'use strict';

const { getCatalog } = require('./data/catalogStore');
const { filterProducts } = require('./retrieval/filterProducts');
const { computeMissingSlots } = require('./state/missingSlots');

/**
 * retrieveForState(state, catalogOverride?) -> filterProducts() result,
 * hoặc { status: 'not_ready', missing_slots, products: [] } nếu state
 * chưa đủ slot bắt buộc.
 *
 * `catalogOverride` cho phép test/inject catalog giả lập thay vì đọc file
 * Excel thật; khi không truyền, dùng catalog thật đã cache (data/catalogStore.js).
 */
function retrieveForState(state, catalogOverride = null) {
  const missingSlots = computeMissingSlots(state);
  if (missingSlots.length > 0) {
    return { status: 'not_ready', missing_slots: missingSlots, products: [] };
  }

  const catalog = catalogOverride || getCatalog();
  const productsForCategory = catalog[state.category] || [];

  return filterProducts(state.category, state.slots, productsForCategory);
}

module.exports = { retrieveForState };

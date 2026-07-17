'use strict';

const { loadCatalogFromExcel, DEFAULT_XLSX_PATH } = require('./loadCatalog');

const cache = new Map();

function getCatalog(filePath = DEFAULT_XLSX_PATH) {
  if (!cache.has(filePath)) {
    cache.set(filePath, loadCatalogFromExcel(filePath));
  }
  return cache.get(filePath);
}

function clearCatalogCache() {
  cache.clear();
}

module.exports = { getCatalog, clearCatalogCache };

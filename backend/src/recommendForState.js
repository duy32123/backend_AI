'use strict';

const { retrieveForState } = require('./retrieveForState');
const { rankProducts } = require('./ranking/rankProducts');

function recommendForState(state, options = {}) {
  const retrieval = retrieveForState(state, options.catalogOverride || null);
  const ranking = rankProducts(retrieval, state, { topN: options.topN });
  return { ...ranking, state, retrieval };
}

module.exports = { recommendForState };

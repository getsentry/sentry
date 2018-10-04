/*eslint no-use-before-define: ["error", { "functions": false }]*/

/**
 * This function is responsible for fetching and storing result data for
 * result tables and visualizations.
 */
export default function createResultManager(queryBuilder) {
  const data = {
    baseQuery: {query: null, data: null},
    byDayQuery: {query: null, data: null},
  };

  return {
    getAll,
    fetchAll,
    reset,
    shouldDisplayResult,
  };

  /**
   * Returns data for all relevant visuzlizations.
   *
   * @returns {Promise<Object>}
   */
  function getAll() {
    return data;
  }

  /**
   * Fetches data for all relevant visuzlizations.
   * Always fetches base query data, and fetches by-day data only if the
   * current query contains an aggregation.
   *
   * @returns {Promise<Object>}
   */
  function fetchAll() {
    const query = queryBuilder.getExternal();
    const baseQuery = queryBuilder.getQueryByType(query, 'baseQuery');
    const byDayQuery = queryBuilder.getQueryByType(query, 'byDayQuery');

    const promises = [queryBuilder.fetch(baseQuery)];

    const hasAggregations = query.aggregations.length > 0;

    // If there are aggregations, get by-day data
    if (hasAggregations) {
      promises.push(queryBuilder.fetch(byDayQuery));
    }

    return Promise.all(promises).then(resp => {
      data.baseQuery.query = query;
      data.baseQuery.data = resp[0];

      if (hasAggregations) {
        data.byDayQuery.query = byDayQuery;
        data.byDayQuery.data = resp[1];
      }

      return data;
    });
  }

  /**
   * Resets data for all visualizations.
   *
   * @returns {Void}
   */
  function reset() {
    for (let key in data) {
      data[key] = {query: null, data: null};
    }
  }

  /**
   * Returns a boolean indicating whether the result whould be displayed.
   * If there is base data available this is true.
   *
   * @returns {Boolean}
   */
  function shouldDisplayResult() {
    return data.baseQuery.data !== null;
  }
}

/*eslint no-use-before-define: ["error", { "functions": false }]*/

/**
 * This function is responsible for fetching and storing result data for
 * result tables and visualizations.
 */
import parseLinkHeader from 'app/utils/parseLinkHeader';

export default function createResultManager(queryBuilder) {
  let data = getDefault();

  return {
    getAll,
    fetchAll,
    reset,
    shouldDisplayResult,
    fetchPage,
  };

  /**
   * Returns data of next or previous page
   * @param {String} pageToFetch
   * @returns {Promise<Object>}
   */
  function fetchPage(pageToFetch) {
    const query = queryBuilder.getExternal();
    const baseQuery = queryBuilder.getQueryByType(query, 'baseQuery');

    let results, cursor;

    if (data.baseQuery[pageToFetch]) {
      results = data.baseQuery[pageToFetch].results;
      cursor = data.baseQuery[pageToFetch].cursor;
    }

    if (results) {
      return queryBuilder.fetch(baseQuery, cursor).then(resp => {
        data.baseQuery.query = query;
        data.baseQuery.data = resp;
        if (resp.pageLinks) {
          const links = parseLinkHeader(resp.pageLinks);
          data.baseQuery.next = links.next;
          data.baseQuery.previous = links.previous;
        }
        return data;
      });
    }
    return Promise.reject(new Error('No New Page Available'));
  }

  /**
   * Returns data for all relevant visualizations.
   *
   * @returns {Promise<Object>}
   */
  function getAll() {
    return data;
  }

  /**
   * Fetches data for all relevant visualizations.
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
      if (resp[0].pageLinks) {
        const links = parseLinkHeader(resp[0].pageLinks);
        data.baseQuery.next = links.next;
        data.baseQuery.previous = links.previous;
      }

      if (hasAggregations) {
        data.byDayQuery.query = byDayQuery;
        data.byDayQuery.data = resp[1];
      } else {
        data.byDayQuery.query = null;
        data.byDayQuery.data = null;
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
    data = getDefault();
  }

  /**
   * Resets all data
   *
   * @returns {Object}
   */
  function getDefault() {
    return {
      baseQuery: {query: null, data: null, next: null, previous: null},
      byDayQuery: {query: null, data: null},
    };
  }

  /**
   * Returns a boolean indicating whether the result should be displayed.
   * If there is base data available this is true.
   *
   * @returns {Boolean}
   */
  function shouldDisplayResult() {
    return data.baseQuery.data !== null;
  }
}

/**
 * This function is responsible for fetching and storing result data for
 * result tables and visualizations.
 */
import parseLinkHeader from 'app/utils/parseLinkHeader';

export default function createResultManager(queryBuilder: any): any {
  let data: any = getDefault();

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
  function fetchPage(pageToFetch: string): Promise<object> {
    const query = queryBuilder.getExternal();
    const baseQuery = queryBuilder.getQueryByType(query, 'baseQuery');

    const cursor = data.baseQuery[pageToFetch];

    if (cursor) {
      return queryBuilder.fetch(baseQuery, cursor).then((resp: any) => {
        data.baseQuery.current = cursor;
        data.baseQuery.query = query;
        data.baseQuery.data = resp;
        updatePageLinks(resp.pageLinks);

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
      promises.push(queryBuilder.fetchWithoutLimit(byDayQuery));
    }

    return Promise.all(promises).then(resp => {
      data.baseQuery.query = query;
      data.baseQuery.data = resp[0];
      data.baseQuery.current = '0:0:1';
      updatePageLinks(resp[0].pageLinks);

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
   * Parses the Links header and sets the relevant next and previous cursor
   * values on the data object
   *
   * @param {Object} pageLinks
   * @returns {Void}
   */
  function updatePageLinks(pageLinks: any): void {
    if (!pageLinks) {
      return;
    }
    const links: any = parseLinkHeader(pageLinks);
    data.baseQuery.next = links.next.results ? links.next.cursor : null;
    data.baseQuery.previous = links.previous.results ? links.previous.cursor : null;
  }

  /**
   * Resets data for all visualizations.
   *
   * @returns {Void}
   */
  function reset(): void {
    data = getDefault();
  }

  /**
   * Returns default data object to store results of all queries
   *
   * @returns {Object}
   */
  function getDefault(): any {
    return {
      baseQuery: {query: null, data: null, next: null, previous: null, current: null},
      byDayQuery: {query: null, data: null},
    };
  }

  /**
   * Returns a boolean indicating whether the result should be displayed.
   * If there is base data available this is true.
   *
   * @returns {Boolean}
   */
  function shouldDisplayResult(): boolean {
    return data.baseQuery.data !== null;
  }
}

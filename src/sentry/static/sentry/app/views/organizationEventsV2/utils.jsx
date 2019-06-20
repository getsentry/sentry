import {pick} from 'lodash';

import {DEFAULT_PER_PAGE} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {ALL_VIEWS, SPECIAL_FIELDS} from './data';

/**
 * Given a view id, return the corresponding view object
 *
 * @param {String} requestedView
 * @returns {Object}
 *
 */
export function getCurrentView(requestedView) {
  return ALL_VIEWS.find(view => view.id === requestedView) || ALL_VIEWS[0];
}

/**
 * Takes a view and converts it into the format required for the events API
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view, location) {
  const fields = [];
  const groupby = view.data.groupby ? [...view.data.groupby] : [];

  view.data.fields.forEach(field => {
    if (SPECIAL_FIELDS.hasOwnProperty(field)) {
      const specialField = SPECIAL_FIELDS[field];

      if (specialField.hasOwnProperty('fields')) {
        fields.push(...specialField.fields);
      }
      if (specialField.hasOwnProperty('groupby')) {
        groupby.push(...specialField.groupby);
      }
    } else {
      fields.push(field);
    }
  });

  const data = pick(location.query, [
    'project',
    'environment',
    'start',
    'end',
    'utc',
    'statsPeriod',
    'cursor',
    'query',
  ]);

  data.field = [...new Set(fields)];
  data.groupby = groupby;
  data.orderby = view.data.orderby;
  data.per_page = DEFAULT_PER_PAGE;

  if (view.data.query) {
    if (data.query) {
      data.query = `${data.query} ${view.data.query}`;
    } else {
      data.query = view.data.query;
    }
  }
  return data;
}

/**
 * Return a location object for the current pathname
 * with a query string reflected the provided tag.
 *
 * @param {String} tagKey
 * @param {String} tagValue
 * @param {Object} browser location object.
 * @return {Object} router target
 */
export function getEventTagSearchUrl(tagKey, tagValue, location) {
  const query = {...location.query};
  // Add tag key/value to search
  if (query.query) {
    query.query += ` ${tagKey}:"${tagValue}"`;
  } else {
    query.query = `${tagKey}:"${tagValue}"`;
  }
  // Remove the event slug so the user sees new search results.
  delete query.eventSlug;

  return {
    pathname: location.pathname,
    query,
  };
}

/**
 * Fetches tag distributions for heatmaps for a single tag keys
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {String} key
 * @param {string} query
 * @returns {Promise<Object>}
 */
export function fetchTagDistribution(api, orgSlug, key, query) {
  const urlParams = pick(query, Object.values(URL_PARAM));

  return api.requestPromise(`/organizations/${orgSlug}/events-heatmap/`, {
    query: {...urlParams, key, query: query.query},
  });
}

/**
 * Fetches total count of events for a given query
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {string} query
 * @returns {Promise<Number>}
 */
export function fetchTotalCount(api, orgSlug, query) {
  const urlParams = pick(query, Object.values(URL_PARAM));

  return api
    .requestPromise(`/organizations/${orgSlug}/events-meta/`, {
      query: {...urlParams, query: query.query},
    })
    .then(res => res.count);
}

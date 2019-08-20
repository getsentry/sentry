import {partial, pick, get} from 'lodash';

import {DEFAULT_PER_PAGE} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {ALL_VIEWS, AGGREGATE_ALIASES, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';

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
 * Takes a view and determines if there are any aggregate fields in it.
 *
 * TODO(mark) This function should be part of an EventView abstraction
 *
 * @param {Object} view
 * @returns {Boolean}
 */
export function hasAggregateField(view) {
  return view.data.fields.some(
    field => AGGREGATE_ALIASES.includes(field) || field.match(/[a-z_]+\([a-z_\.]+\)/)
  );
}

/**
 * Takes a view and converts it into the format required for the events API
 *
 * TODO(mark) This function should be part of an EventView abstraction
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view, location) {
  const groupby = view.data.groupby ? [...view.data.groupby] : [];
  const fields = get(view, 'data.fields', []);

  const data = pick(location.query, [
    'project',
    'environment',
    'start',
    'end',
    'utc',
    'statsPeriod',
    'cursor',
    'sort',
  ]);

  data.field = [...new Set(fields)];
  data.groupby = groupby;
  if (!data.sort) {
    data.sort = view.data.sort;
  }
  data.per_page = DEFAULT_PER_PAGE;
  data.query = getQueryString(view, location);

  return data;
}

/**
 * Generate a querystring based on the view defaults, current
 * location and any additional parameters
 *
 * TODO(mark) This function should be part of an EventView abstraction
 *
 * @param {Object} view defaults containing `.data.query`
 * @param {Location} browser location
 */
export function getQueryString(view, location) {
  const queryParts = [];
  if (view.data.query) {
    queryParts.push(view.data.query);
  }
  if (location.query && location.query.query) {
    queryParts.push(location.query.query);
  }

  return queryParts.join(' ');
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
 * Fetches tag distributions for a single tag key
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {String} key
 * @param {string} query
 * @returns {Promise<Object>}
 */
export function fetchTagDistribution(api, orgSlug, key, query) {
  const urlParams = pick(query, Object.values(URL_PARAM));

  return api.requestPromise(`/organizations/${orgSlug}/events-distribution/`, {
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

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getFieldRenderer(field, meta) {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }
  // Inflect the field name so it will match the property in the result set.
  const fieldName = field.replace(/^([^\(]+)\(([a-z\._+]+)\)$/, '$1_$2');
  const fieldType = meta[fieldName];
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

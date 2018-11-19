import moment from 'moment';
import {Client} from 'app/api';
import {isValidAggregation} from './aggregations/utils';
import {NON_SNUBA_FIELDS} from './data';

export function getQueryFromQueryString(queryString) {
  const validQueryKeys = new Set([
    'projects',
    'fields',
    'conditions',
    'aggregations',
    'range',
    'start',
    'end',
    'orderby',
    'limit',
  ]);

  const result = {};
  let parsedQuery = queryString;
  parsedQuery = parsedQuery.replace(/^\?|\/$/g, '').split('&');
  parsedQuery.forEach(item => {
    if (item.includes('=')) {
      const [key, value] = item.split('=');
      if (validQueryKeys.has(key)) {
        result[key] = JSON.parse(decodeURIComponent(value));
      }
    }
  });

  return result;
}

export function getQueryStringFromQuery(query) {
  const queryProperties = Object.entries(query).map(([key, value]) => {
    return key + '=' + encodeURIComponent(JSON.stringify(value));
  });

  return `?${queryProperties.join('&')}`;
}

export function getOrderByOptions(queryBuilder) {
  const columns = queryBuilder.getColumns();
  const query = queryBuilder.getInternal();

  // If there are valid aggregations, only allow summarized fields and aggregations in orderby
  const validAggregations = query.aggregations.filter(agg =>
    isValidAggregation(agg, columns)
  );

  const hasAggregations = validAggregations.length > 0;

  const hasFields = query.fields.length > 0;

  const columnOptions = columns.reduce((acc, {name}) => {
    if (hasAggregations) {
      const isInvalidField = hasFields && !query.fields.includes(name);
      if (!hasFields || isInvalidField) {
        return acc;
      }
    }

    // Never allow ordering by project.name or issue.id since this can't be done in Snuba
    if (NON_SNUBA_FIELDS.includes(name)) {
      return acc;
    }

    return [
      ...acc,
      {value: name, label: `${name} asc`},
      {value: `-${name}`, label: `${name} desc`},
    ];
  }, []);

  const aggregationOptions = [
    // Ensure aggregations are unique (since users might input duplicates)
    ...new Set(validAggregations.map(aggregation => aggregation[2])),
  ].reduce((acc, agg) => {
    return [
      ...acc,
      {value: agg, label: `${agg} asc`},
      {value: `-${agg}`, label: `${agg} desc`},
    ];
  }, []);

  return [...columnOptions, ...aggregationOptions];
}

/**
 * Takes the params object and the requested view querystring and returns the
 * correct view to be displayed
 *
 * @param {Object} params
 * @param {String} reqeustedView
 * @returns {String} View
 */
export function getView(params, requestedView) {
  if (typeof params.savedQueryId !== 'undefined') {
    requestedView = 'saved';
  }

  switch (requestedView) {
    case 'saved':
      return 'saved';
    default:
      return 'query';
  }
}

/**
 * Takes a saved query and strips associated query metadata in order to match
 * our internal representation of queries.
 *
 * @param {Object} savedQuery
 * @returns {Object}
 */
export function parseSavedQuery(savedQuery) {
  // eslint-disable-next-line no-unused-vars
  const {id, name, dateCreated, dateUpdated, createdBy, ...query} = savedQuery;
  return query;
}

export function fetchSavedQuery(organization, queryId) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${queryId}/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  });
}

export function fetchSavedQueries(organization) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  });
}

export function createSavedQuery(organization, data) {
  const api = new Client();

  const endpoint = `/organizations/${organization.slug}/discover/saved/`;
  return api.requestPromise(endpoint, {
    method: 'POST',
    data,
  });
}

export function updateSavedQuery(organization, id, data) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    method: 'PUT',
    data,
  });
}

export function deleteSavedQuery(organization, id) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    method: 'DELETE',
  });
}

/**
 * Generate a saved query name based on the current timestamp
 *
 * @returns {String}
 */
export function generateQueryName() {
  return `Result - ${moment.utc().format('MMM DD HH:mm:ss')}`;
}

import {Client} from 'app/api';
import {isEqual, pick} from 'lodash';
import moment from 'moment';
import qs from 'query-string';

// eslint-disable-next-line no-unused-vars
import {isValidAggregation} from './aggregations/utils';
import {NON_SNUBA_FIELDS} from './data';
import {SnubaResult} from './types';

const VALID_QUERY_KEYS = [
  'projects',
  'fields',
  'conditions',
  'aggregations',
  'range',
  'start',
  'end',
  'orderby',
  'limit',
];

export function getQueryFromQueryString(queryString: string): {[key: string]: string} {
  const queryKeys = new Set([...VALID_QUERY_KEYS, 'utc']);
  const result: {[key: string]: string} = {};
  const parsedQuery = queryString.replace(/^\?|\/$/g, '').split('&');
  parsedQuery.forEach((item: string) => {
    if (item.includes('=')) {
      const [key, value] = item.split('=');
      if (queryKeys.has(key)) {
        result[key] = JSON.parse(decodeURIComponent(value));
      }
    }
  });
  return result;
}

export function getQueryStringFromQuery(
  query: {[key: string]: string},
  queryParams: object = {}
): string {
  const queryProperties = Object.entries(query).map(
    ([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`
  );

  Object.entries(queryParams).forEach(([key, value]) => {
    queryProperties.push(`${key}=${value}`);
  });

  return `?${queryProperties.sort().join('&')}`;
}

export function getOrderbyFields(queryBuilder: any): any {
  const columns = queryBuilder.getColumns();
  const query = queryBuilder.getInternal();

  // If there are valid aggregations, only allow summarized fields and aggregations in orderby
  const validAggregations = query.aggregations.filter((agg: SnubaResult) =>
    isValidAggregation(agg, columns)
  );

  const hasAggregations = validAggregations.length > 0;

  const hasFields = query.fields.length > 0;

  const columnOptions = columns.reduce((acc: any, {name}: any) => {
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

    return [...acc, {value: name, label: name}];
  }, []);

  const aggregationOptions = validAggregations
    .map((aggregation: any) => aggregation[2])
    .reduce((acc: any, agg: any) => [...acc, {value: agg, label: agg}], []);

  return [...columnOptions, ...aggregationOptions];
}

/**
 * Takes the params object and the requested view querystring and returns the
 * correct view to be displayed
 */
export function getView(params: any, requestedView: string): string {
  let defaultRequestedView = requestedView;
  if (typeof params.savedQueryId !== 'undefined') {
    defaultRequestedView = 'saved';
  }

  switch (defaultRequestedView) {
    case 'saved':
      return 'saved';
    default:
      return 'query';
  }
}

/**
 * Returns true if the underlying discover query has changed based on the
 * querystring, otherwise false.
 *
 * @param prev previous location.search string
 * @param next next location.search string
 */
export function queryHasChanged(prev: string, next: string): boolean {
  return !isEqual(
    pick(qs.parse(prev), VALID_QUERY_KEYS),
    pick(qs.parse(next), VALID_QUERY_KEYS)
  );
}

/**
 * Takes a saved query and strips associated query metadata in order to match
 * our internal representation of queries.
 */
export function parseSavedQuery(savedQuery: any): any {
  // eslint-disable-next-line no-unused-vars
  const {id, name, dateCreated, dateUpdated, createdBy, ...query} = savedQuery;
  return query;
}

export function fetchSavedQuery(organization: any, queryId: any): any {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${queryId}/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  } as any); // TODO: Remove as any
}

export function fetchSavedQueries(organization: any): any {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  } as any); // TODO: Remove as any
}

export function createSavedQuery(organization: any, data: any): any {
  const api = new Client();

  const endpoint = `/organizations/${organization.slug}/discover/saved/`;
  return api.requestPromise(endpoint, {
    data,
    method: 'POST',
  } as any); // TODO: Remove as any
}

export function updateSavedQuery(organization: any, id: any, data: any): any {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    data,
    method: 'PUT',
  } as any); // TODO: Remove as any
}

export function deleteSavedQuery(organization: any, id: any): any {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    method: 'DELETE',
  } as any); // TODO: Remove as any
}

/**
 * Generate a saved query name based on the current timestamp
 */
export function generateQueryName(): string {
  return `Result - ${moment.utc().format('MMM DD HH:mm:ss')}`;
}

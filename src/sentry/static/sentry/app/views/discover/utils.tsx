import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import moment from 'moment';
import * as qs from 'query-string';

import {Client} from 'app/api';

import {isValidAggregation} from './aggregations/utils';
import {NON_SNUBA_FIELDS} from './data';
import {Aggregation, Column, ReactSelectOption, SavedQuery} from './types';

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

export function getQueryFromQueryString(queryString: string): {[key: string]: any} {
  const queryKeys = new Set([...VALID_QUERY_KEYS, 'utc']);
  const result: {[key: string]: any} = {};
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
  query: {[key: string]: any},
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

export function getOrderbyFields(queryBuilder: any): ReactSelectOption[] {
  const columns = queryBuilder.getColumns();
  const query = queryBuilder.getInternal();

  // If there are valid aggregations, only allow summarized fields and aggregations in orderby
  const validAggregations = query.aggregations.filter((agg: Aggregation) =>
    isValidAggregation(agg, columns)
  );

  const hasAggregations = validAggregations.length > 0;

  const hasFields = query.fields.length > 0;

  const columnOptions = columns.reduce((acc: ReactSelectOption[], {name}: Column) => {
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
    .map((aggregation: Aggregation) => aggregation[2])
    .reduce(
      (acc: Aggregation[], agg: Aggregation) => [...acc, {value: agg, label: agg}],
      []
    );

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
export function parseSavedQuery(savedQuery: any): SavedQuery {
  const {
    id: _id,
    name: _name,
    dateCreated: _dateCreated,
    dateUpdated: _dateUpdated,
    createdBy: _createdBy,
    ...query
  } = savedQuery;
  return query;
}

export function fetchSavedQuery(organization: any, queryId: string): Promise<any> {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${queryId}/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  } as any); // TODO(ts): Remove as any
}

export function fetchSavedQueries(organization: any): Promise<any> {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
    query: {all: 1, query: 'version:1', sortBy: '-dateUpdated'},
  } as any); // TODO(ts): Remove as any
}

export function createSavedQuery(organization: any, data: any): Promise<any> {
  const api = new Client();

  const endpoint = `/organizations/${organization.slug}/discover/saved/`;
  return api.requestPromise(endpoint, {
    data,
    method: 'POST',
  } as any); // TODO(ts): Remove as any
}

export function updateSavedQuery(organization: any, id: any, data: any): Promise<any> {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    data,
    method: 'PUT',
  } as any); // TODO(ts): Remove as any
}

export function deleteSavedQuery(organization: any, id: any): Promise<any> {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    method: 'DELETE',
  } as any); // TODO(ts): Remove as any
}

/**
 * Generate a saved query name based on the current timestamp
 */
export function generateQueryName(): string {
  return `Result - ${moment.utc().format('MMM DD HH:mm:ss')}`;
}

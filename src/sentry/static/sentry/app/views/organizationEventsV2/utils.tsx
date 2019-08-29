import {partial, pick} from 'lodash';
import {Location} from 'history';

import {Client} from 'app/api';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {
  AGGREGATE_ALIASES,
  SPECIAL_FIELDS,
  FIELD_FORMATTERS,
  FieldTypes,
  FieldFormatterRenderFunctionPartial,
} from './data';
import EventView from './eventView';

export type EventQuery = {
  field: Array<string>;
  project?: string;
  sort?: string | string[];
  query: string;
  per_page?: number;
};

/**
 * Takes a view and determines if there are any aggregate fields in it.
 *
 *
 * @param {Object} view
 * @returns {Boolean}
 */
export function hasAggregateField(eventView: EventView): boolean {
  return eventView
    .getFieldNames()
    .some(
      field =>
        AGGREGATE_ALIASES.includes(field as any) || field.match(/[a-z_]+\([a-z_\.]+\)/)
    );
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
export function getEventTagSearchUrl(
  tagKey: string,
  tagValue: string,
  location: Location
) {
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

export type TagTopValue = {
  url: {
    pathname: string;
    query: any;
  };
  value: string;
};

export type Tag = {
  topValues: Array<TagTopValue>;
};

/**
 * Fetches tag distributions for a single tag key
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {String} key
 * @param {String} query
 * @returns {Promise<Object>}
 */
export function fetchTagDistribution(
  api: Client,
  orgSlug: string,
  key: string,
  query: EventQuery
): Promise<Tag> {
  const urlParams = pick(query, Object.values(URL_PARAM));

  const queryOption = {...urlParams, key, query: query.query};

  return api.requestPromise(`/organizations/${orgSlug}/events-distribution/`, {
    query: queryOption,
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
export function fetchTotalCount(
  api: Client,
  orgSlug: String,
  query: EventQuery
): Promise<number> {
  const urlParams = pick(query, Object.values(URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  type Response = {
    count: number;
  };

  return api
    .requestPromise(`/organizations/${orgSlug}/events-meta/`, {
      query: queryOption,
    })
    .then((res: Response) => res.count);
}

export type MetaType = {
  [key: string]: FieldTypes;
};

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getFieldRenderer(
  field: string,
  meta: MetaType
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }
  const fieldName = getAggregateAlias(field);
  const fieldType = meta[fieldName];
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

const AGGREGATE_PATTERN = /^([^\(]+)\(([a-z\._+]*)\)$/;

/**
 * Get the alias that the API results will have for a given aggregate function name
 */
export function getAggregateAlias(field: string): string {
  if (!field.match(AGGREGATE_PATTERN)) {
    return field;
  }
  return field
    .replace(AGGREGATE_PATTERN, '$1_$2')
    .replace('.', '_')
    .replace(/_+$/, '')
    .toLowerCase();
}

/**
 * Get the first query string of a given name if there are multiple occurrences of it
 * e.g. foo=42&foo=bar    ==>    foo=42 is the first occurrence for 'foo' and "42" will be returned.
 *
 * @param query     query string map
 * @param name      name of the query string field
 */
export function getFirstQueryString(
  query: {[key: string]: string | string[] | null | undefined},
  name: string,
  defaultValue?: string
): string | undefined {
  const needle = query[name];

  if (typeof needle === 'string') {
    return needle;
  }

  if (Array.isArray(needle) && needle.length > 0) {
    if (typeof needle[0] === 'string') {
      return needle[0];
    }
  }

  return defaultValue;
}

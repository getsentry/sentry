import {partial, pick, get} from 'lodash';
import {ReactRouterLocation} from 'app/types/reactRouter';

import {Client} from 'app/api';
import {EventView} from 'app/types';
import {DEFAULT_PER_PAGE} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {ALL_VIEWS, SPECIAL_FIELDS, FIELD_FORMATTERS} from './data';

/**
 * Given a view id, return the corresponding view object
 *
 * @param {String} requestedView
 * @returns {Object}
 *
 */
export function getCurrentView(requestedView?: string): EventView {
  return ALL_VIEWS.find(view => view.id === requestedView) || ALL_VIEWS[0];
}

export type EventQuery = {
  field: Array<string>;
  project?: string;
  sort?: string;
  query: string;
};

/**
 * Takes a view and converts it into the format required for the events API
 *
 * @param {Object} view
 * @returns {Object}
 */
export function getQuery(view: EventView, location: ReactRouterLocation) {
  const fields: Array<string> = get(view, 'data.fields', []);

  type LocationQuery = {
    project?: string;
    environment?: string;
    start?: string;
    end?: string;
    utc?: string;
    statsPeriod?: string;
    cursor?: string;
    sort?: string;
  };

  const picked = pick<LocationQuery>(location.query, [
    'project',
    'environment',
    'start',
    'end',
    'utc',
    'statsPeriod',
    'cursor',
    'sort',
  ]);

  const data: EventQuery = Object.assign(picked, {
    field: [...new Set(fields)],
    sort: picked.sort ? picked.sort : view.data.sort,
    per_page: DEFAULT_PER_PAGE,
    query: getQueryString(view, location),
  });

  return data;
}

/**
 * Generate a querystring based on the view defaults, current
 * location and any additional parameters
 *
 * @param {Object} view defaults containing `.data.query`
 * @param {Location} browser location
 * @param {Object} additional parameters to merge into the query string.
 */
export function getQueryString(
  view: EventView,
  location: ReactRouterLocation,
  additional?: {[key: string]: string}
): string {
  const queryParts: Array<string> = [];
  if (view.data.query) {
    queryParts.push(view.data.query);
  }
  if (location.query && location.query.query) {
    // there may be duplicate query in the query string
    // e.g. query=hello&query=world
    if (Array.isArray(location.query.query)) {
      location.query.query.forEach(query => {
        queryParts.push(query);
      });
    }

    if (typeof location.query.query === 'string') {
      queryParts.push(location.query.query);
    }
  }
  if (additional) {
    Object.entries(additional).forEach(([key, value]) => {
      if (value) {
        queryParts.push(`${key}:${value}`);
      }
    });
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
export function getEventTagSearchUrl(
  tagKey: string,
  tagValue: string,
  location: ReactRouterLocation
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

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getFieldRenderer(field: string, meta) {
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

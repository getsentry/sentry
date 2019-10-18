import {partial, pick} from 'lodash';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {generateQueryWithTag} from 'app/utils';

import {
  AGGREGATE_ALIASES,
  SPECIAL_FIELDS,
  LINK_FORMATTERS,
  FIELD_FORMATTERS,
  FieldTypes,
  FieldFormatterRenderFunctionPartial,
} from './data';
import EventView from './eventView';
import {
  Aggregation,
  Field,
  AGGREGATIONS,
  FIELDS,
  ColumnValueType,
} from './eventQueryParams';
import {TableColumn} from './table/types';

export type EventQuery = {
  field: Array<string>;
  project?: string;
  sort?: string | string[];
  query: string;
  per_page?: number;
};

const AGGREGATE_PATTERN = /^([^\(]+)\(([a-z\._+]*)\)$/;
const ROUND_BRACKETS_PATTERN = /[\(\)]/;

/**
 * Takes a view and determines if there are any aggregate fields in it.
 *
 *
 * @param {Object} view
 * @returns {Boolean}
 */
export function hasAggregateField(eventView: EventView): boolean {
  return eventView
    .getFields()
    .some(
      field => AGGREGATE_ALIASES.includes(field as any) || field.match(AGGREGATE_PATTERN)
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
  const query = generateQueryWithTag(location.query, {key: tagKey, value: tagValue});

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
 * @param {boolean} Whether or not to coerce a field into a link.
 * @returns {Function}
 */
export function getFieldRenderer(
  field: string,
  meta: MetaType,
  forceLink: boolean
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }
  const fieldName = getAggregateAlias(field);
  const fieldType = meta[fieldName];

  // If the current field is being coerced to a link
  // use a different formatter set based on the type.
  if (forceLink && LINK_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(LINK_FORMATTERS[fieldType], fieldName);
  }

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

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

export type QueryWithColumnState =
  | Query
  | {
      fieldnames: string | string[] | null | undefined;
      field: string | string[] | null | undefined;
      sort: string | string[] | null | undefined;
    };

const TEMPLATE_TABLE_COLUMN: TableColumn<React.ReactText> = {
  key: '',
  name: '',
  aggregation: '',
  field: '',

  type: 'never',
  isSortable: false,
  isPrimary: false,
};

export function decodeColumnOrder(props: {
  fieldnames: string[];
  field: string[];
}): TableColumn<React.ReactText>[] {
  const {fieldnames, field} = props;
  const columnsRaw: {
    aggregationField: string;
    name: string;
  }[] = [];

  if (typeof fieldnames === 'string' && typeof field === 'string') {
    columnsRaw.push({aggregationField: field, name: fieldnames});
  } else if (
    Array.isArray(fieldnames) &&
    Array.isArray(field) &&
    fieldnames.length === field.length
  ) {
    field.forEach((f, i) => {
      columnsRaw.push({aggregationField: f, name: fieldnames[i]});
    });
  }

  return columnsRaw.map(col => {
    const column: TableColumn<React.ReactText> = {...TEMPLATE_TABLE_COLUMN};

    // "field" will be split into ["field"]
    // "agg()" will be split into ["agg", "", ""]
    // "agg(field)" will be split to ["agg", "field", ""]
    // Any column without brackets are assumed to be a field
    const aggregationField = col.aggregationField.split(ROUND_BRACKETS_PATTERN);

    if (aggregationField.length === 1) {
      column.field = aggregationField[0] as Field;
    } else {
      column.aggregation = aggregationField[0] as Aggregation;
      column.field = aggregationField[1] as Field;
    }

    column.key = col.aggregationField;
    column.name = col.name;
    column.type = (FIELDS[column.field] || 'never') as ColumnValueType;

    column.isSortable = AGGREGATIONS[column.aggregation]
      ? AGGREGATIONS[column.aggregation].isSortable
      : false;
    column.isPrimary = column.field === 'title';

    return column;
  });
}

export function pushEventViewToLocation(props: {
  location: Location;
  currentEventView: EventView;
  nextEventView: EventView;
}) {
  const {location, nextEventView} = props;

  const queryStringObject = nextEventView.generateQueryStringObject();

  browserHistory.push({
    ...location,
    query: queryStringObject,
  });
}

export function getSortKey(
  fieldAsString: string,
  tableDataMeta: MetaType
): string | null {
  const column = getAggregateAlias(fieldAsString);
  if (SPECIAL_FIELDS.hasOwnProperty(column)) {
    return SPECIAL_FIELDS[column as keyof typeof SPECIAL_FIELDS].sortField;
  }

  if (FIELD_FORMATTERS.hasOwnProperty(tableDataMeta[column])) {
    return FIELD_FORMATTERS[tableDataMeta[column] as keyof typeof FIELD_FORMATTERS]
      .sortField
      ? column
      : null;
  }

  return null;
}

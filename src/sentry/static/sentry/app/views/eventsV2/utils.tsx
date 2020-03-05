import Papa from 'papaparse';
import partial from 'lodash/partial';
import pick from 'lodash/pick';
import isString from 'lodash/isString';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';

import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {t} from 'app/locale';
import {Event, StringMap, Organization, OrganizationSummary} from 'app/types';
import {Client} from 'app/api';
import {getTitle} from 'app/utils/events';
import {getUtcDateString} from 'app/utils/dates';
import {TagSegment} from 'app/components/tagDistributionMeter';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {disableMacros} from 'app/views/discover/result/utils';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';

import {
  AGGREGATE_ALIASES,
  SPECIAL_FIELDS,
  FIELD_FORMATTERS,
  FieldTypes,
  FieldFormatterRenderFunctionPartial,
  ALL_VIEWS,
  TRANSACTION_VIEWS,
} from './data';
import EventView, {Field as FieldType, Column} from './eventView';
import {Aggregation, Field, AGGREGATIONS, FIELDS} from './eventQueryParams';
import {TableColumn, TableDataRow} from './table/types';

export type EventQuery = {
  field: string[];
  project?: string | string[];
  sort?: string | string[];
  query: string;
  per_page?: number;
};

const AGGREGATE_PATTERN = /^([^\(]+)\((.*)\)$/;
const ROUND_BRACKETS_PATTERN = /[\(\)]/;

function explodeFieldString(field: string): {aggregation: string; field: string} {
  const results = field.match(AGGREGATE_PATTERN);

  if (results && results.length >= 3) {
    return {aggregation: results[1], field: results[2]};
  }

  return {aggregation: '', field};
}

export function explodeField(field: FieldType): Column {
  const results = explodeFieldString(field.field);

  return {
    aggregation: results.aggregation,
    field: results.field,
    width: field.width || COL_WIDTH_UNDEFINED,
  };
}

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
 * Check if a field name looks like an aggregate function or known aggregate alias.
 */
export function isAggregateField(field: string): boolean {
  return (
    AGGREGATE_ALIASES.includes(field as any) || field.match(AGGREGATE_PATTERN) !== null
  );
}

export type Tag = {
  key: string;
  topValues: Array<TagSegment>;
};

/**
 * Fetches tag facets for a query
 *
 * @param {Object} api
 * @param {String} orgSlug
 * @param {String} query
 * @returns {Promise<Object>}
 */
export function fetchTagFacets(
  api: Client,
  orgSlug: string,
  query: EventQuery
): Promise<Tag[]> {
  const urlParams = pick(query, Object.values(URL_PARAM));

  const queryOption = {...urlParams, query: query.query};

  return api.requestPromise(`/organizations/${orgSlug}/events-facets/`, {
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

/**
 * Get the alias that the API results will have for a given aggregate function name
 */
export function getAggregateAlias(field: string): string {
  if (!field.match(AGGREGATE_PATTERN)) {
    return field;
  }
  return field
    .replace(AGGREGATE_PATTERN, '$1_$2')
    .replace(/\./g, '_')
    .replace(/_+$/, '');
}

export type QueryWithColumnState =
  | Query
  | {
      field: string | string[] | null | undefined;
      sort: string | string[] | null | undefined;
    };

const TEMPLATE_TABLE_COLUMN: TableColumn<React.ReactText> = {
  key: '',
  aggregation: '',
  field: '',
  name: '',
  width: COL_WIDTH_UNDEFINED,

  type: 'never',
  isSortable: false,

  eventViewField: Object.freeze({field: '', width: COL_WIDTH_UNDEFINED}),
};

export function decodeColumnOrder(
  fields: Readonly<FieldType[]>
): TableColumn<React.ReactText>[] {
  return fields.map((f: FieldType) => {
    const col = {aggregationField: f.field, name: f.field, width: f.width};
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

    // Aggregations can have a strict outputType or they can inherit from their field.
    // Otherwise use the FIELDS data to infer types.
    const aggregate = AGGREGATIONS[column.aggregation];
    if (aggregate && aggregate.outputType) {
      column.type = aggregate.outputType;
    } else {
      column.type = FIELDS[column.field];
    }
    column.width = col.width;

    column.name = column.key;
    column.isSortable = AGGREGATIONS[column.aggregation]
      ? AGGREGATIONS[column.aggregation].isSortable
      : false;
    column.eventViewField = f;

    return column;
  });
}

export function pushEventViewToLocation(props: {
  location: Location;
  nextEventView: EventView;
  extraQuery?: Query;
}) {
  const {location, nextEventView} = props;

  const extraQuery = props.extraQuery || {};

  const queryStringObject = nextEventView.generateQueryStringObject();

  browserHistory.push({
    ...location,
    query: {
      ...extraQuery,
      ...queryStringObject,
    },
  });
}

export function generateTitle({eventView, event}: {eventView: EventView; event?: Event}) {
  const titles = [t('Discover')];

  const eventViewName = eventView.name;
  if (typeof eventViewName === 'string' && String(eventViewName).trim().length > 0) {
    titles.push(String(eventViewName).trim());
  }

  const eventTitle = event ? getTitle(event).title : undefined;

  if (eventTitle) {
    titles.push(eventTitle);
  }

  titles.reverse();

  return titles.join(' - ');
}

export function getPrebuiltQueries(organization: Organization) {
  let views = ALL_VIEWS;
  if (organization.features.includes('transaction-events')) {
    // insert transactions queries at index 2
    const cloned = [...ALL_VIEWS];
    cloned.splice(2, 0, ...TRANSACTION_VIEWS);
    views = cloned;
  }

  return views;
}

export function decodeScalar(
  value: string[] | string | undefined | null
): string | undefined {
  if (!value) {
    return undefined;
  }
  const unwrapped =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : isString(value)
      ? value
      : undefined;
  return isString(unwrapped) ? unwrapped : undefined;
}

export function downloadAsCsv(tableData, columnOrder, filename) {
  const {data} = tableData;
  const headings = columnOrder.map(column => column.name);

  const csvContent = Papa.unparse({
    fields: headings,
    data: data.map(row =>
      headings.map(col => {
        col = getAggregateAlias(col);
        return disableMacros(row[col]);
      })
    ),
  });

  // Need to also manually replace # since encodeURI skips them
  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  // Create a download link then click it, this is so we can get a filename
  const link = document.createElement('a');
  const now = new Date();
  link.setAttribute('href', encodedDataUrl);
  link.setAttribute('download', `${filename} ${getUtcDateString(now)}.csv`);
  link.click();
  link.remove();
}

// transform a given aggregated field to its un-aggregated form.
// the given field can be transformed into another field, or undefined if it'll need to be dropped.
type AggregateTransformer = (field: string) => string | undefined;

// a map between a field alias to a transform function to convert the aggregated field alias into
// its un-aggregated form
const TRANSFORM_AGGREGATES: {[field: string]: AggregateTransformer} = {
  p99: () => 'transaction.duration',
  p95: () => 'transaction.duration',
  p75: () => 'transaction.duration',
  last_seen: () => 'timestamp',
  latest_event: () => 'id',
  apdex: () => undefined,
  impact: () => undefined,
};

/**
 * Convert an aggregated query into one that does not have aggregates.
 * Can also apply additions conditions defined in `additionalConditions`
 * and generate conditions based on the `dataRow` parameter and the current fields
 * in the `eventView`.
 */
export function getExpandedResults(
  eventView: EventView,
  additionalConditions: StringMap<string>,
  dataRow?: TableDataRow | Event
): EventView {
  // Find aggregate fields and flag them for updates.
  const fieldsToUpdate: number[] = [];
  eventView.fields.forEach((field: FieldType, index: number) => {
    const column = explodeField(field);
    if (column.aggregation || AGGREGATE_ALIASES.includes(column.field)) {
      fieldsToUpdate.push(index);
    }
  });

  let nextView = eventView.clone();
  const transformedFields = new Set();
  const fieldsToDelete: number[] = [];

  // make a best effort to replace aggregated columns with their non-aggregated form
  fieldsToUpdate.forEach((indexToUpdate: number) => {
    const currentField: FieldType = nextView.fields[indexToUpdate];
    const exploded = explodeField(currentField);

    // check if we can use an aggregated transform function
    const fieldNameAlias = TRANSFORM_AGGREGATES[exploded.aggregation]
      ? exploded.aggregation
      : TRANSFORM_AGGREGATES[exploded.field]
      ? exploded.field
      : undefined;

    const transform = fieldNameAlias && TRANSFORM_AGGREGATES[fieldNameAlias];

    if (fieldNameAlias && transform) {
      const nextFieldName = transform(fieldNameAlias);

      if (!nextFieldName || transformedFields.has(nextFieldName)) {
        // this field is either duplicated in another column, or nextFieldName is undefined.
        // in either case, we remove this column
        fieldsToDelete.push(indexToUpdate);
        return;
      }

      const updatedColumn = {
        aggregation: '',
        field: nextFieldName,
        width: exploded.width,
      };

      transformedFields.add(nextFieldName);
      nextView = nextView.withUpdatedColumn(indexToUpdate, updatedColumn, undefined);

      return;
    }

    // edge case: transform count() into id
    if (exploded.aggregation === 'count') {
      exploded.field = 'id';
    }

    if (!exploded.field || transformedFields.has(exploded.field)) {
      // If we don't have a field, or already have it, remove the current column
      fieldsToDelete.push(indexToUpdate);
      return;
    }

    transformedFields.add(exploded.field);

    const updatedColumn = {
      aggregation: '',
      field: exploded.field,
      width: exploded.width,
    };

    nextView = nextView.withUpdatedColumn(indexToUpdate, updatedColumn, undefined);
  });

  // delete any columns marked for deletion
  fieldsToDelete.reverse().forEach((index: number) => {
    nextView = nextView.withDeletedColumn(index, undefined);
  });

  nextView.query = generateExpandedConditions(nextView, additionalConditions, dataRow);

  return nextView;
}

/**
 * Create additional conditions based on the fields in an EventView
 * and a datarow/event
 */
function generateAdditionalConditions(
  eventView: EventView,
  dataRow?: TableDataRow | Event
): StringMap<string> {
  const specialKeys = Object.values(URL_PARAM);
  const conditions: StringMap<string> = {};

  if (!dataRow) {
    return conditions;
  }

  eventView.fields.forEach((field: FieldType) => {
    const column = explodeField(field);

    // Skip aggregate fields
    if (column.aggregation || AGGREGATE_ALIASES.includes(column.field)) {
      return;
    }

    const dataKey = getAggregateAlias(field.field);
    // Append the current field as a condition if it exists in the dataRow
    // Or is a simple key in the event. More complex deeply nested fields are
    // more challenging to get at as their location in the structure does not
    // match their name.
    if (dataRow[dataKey]) {
      const nextValue = String(dataRow[dataKey]).trim();

      switch (column.field) {
        case 'timestamp':
          // normalize the "timestamp" field to ensure the payload works
          conditions[column.field] = getUtcDateString(nextValue);
          break;
        default:
          conditions[column.field] = nextValue;
      }
    }

    // If we have an event, check tags as well.
    if (dataRow.tags && dataRow.tags instanceof Array) {
      const tagIndex = dataRow.tags.findIndex(item => item.key === dataKey);
      if (tagIndex > -1) {
        const key = specialKeys.includes(column.field)
          ? `tags[${column.field}]`
          : column.field;
        conditions[key] = dataRow.tags[tagIndex].value;
      }
    }
  });
  return conditions;
}

function generateExpandedConditions(
  eventView: EventView,
  additionalConditions: StringMap<string>,
  dataRow?: TableDataRow | Event
): string {
  const parsedQuery = tokenizeSearch(eventView.query);

  // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.
  for (const key in parsedQuery) {
    const column = explodeFieldString(key);
    if (column.aggregation) {
      delete parsedQuery[key];
    }
  }

  const conditions = Object.assign(
    {},
    additionalConditions,
    generateAdditionalConditions(eventView, dataRow)
  );

  // Add additional conditions provided and generated.
  for (const key in conditions) {
    if (key === 'project.id') {
      eventView.project = [...eventView.project, parseInt(additionalConditions[key], 10)];
      continue;
    }
    if (key === 'environment') {
      eventView.environment = [...eventView.environment, additionalConditions[key]];
      continue;
    }
    const column = explodeFieldString(key);
    // Skip aggregates as they will be invalid.
    if (column.aggregation) {
      continue;
    }
    // Skip project name
    if (key === 'project' || key === 'project.name') {
      continue;
    }
    parsedQuery[key] = [conditions[key]];
  }

  return stringifyQueryObject(parsedQuery);
}

export function getDiscoverLandingUrl(organization: OrganizationSummary): string {
  if (organization.features.includes('discover-query')) {
    return `/organizations/${organization.slug}/discover/queries/`;
  }
  return `/organizations/${organization.slug}/discover/results/`;
}

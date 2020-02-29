import Papa from 'papaparse';
import partial from 'lodash/partial';
import pick from 'lodash/pick';
import isString from 'lodash/isString';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';

import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {t} from 'app/locale';
import {Event, Organization, OrganizationSummary} from 'app/types';
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
  isDragging: false,
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

    // Aggregations on any field make numbers.
    // Otherwise use the FIELDS data to infer types.
    if (
      AGGREGATIONS[column.aggregation] &&
      AGGREGATIONS[column.aggregation].type === '*'
    ) {
      column.type = 'number';
    } else if (FIELDS[column.aggregation]) {
      column.type = FIELDS[column.aggregation];
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
    data: data.map(row => {
      return headings.map(col => {
        // alias for project doesn't match the table data name
        if (col === 'project') {
          col = 'project.name';
        } else {
          col = getAggregateAlias(col);
        }
        return disableMacros(row[col]);
      });
    }),
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

export function getExpandedResults(
  eventView: EventView,
  additionalConditions: {[key: string]: string},
  dataRow?: TableDataRow | Event
): EventView {
  let nextView = eventView.clone();
  const fieldsToUpdate: number[] = [];
  const specialKeys = Object.values(URL_PARAM);

  nextView.fields.forEach((field: FieldType, index: number) => {
    const column = explodeField(field);

    // Mark aggregated fields to be transformed into its un-aggregated form
    if (column.aggregation || AGGREGATE_ALIASES.includes(column.field)) {
      fieldsToUpdate.push(index);
      return;
    }

    const dataKey = getAggregateAlias(field.field);
    // Append the current field as a condition if it exists in the dataRow
    // Or is a simple key in the event. More complex deeply nested fields are
    // more challenging to get at as their location in the structure does not
    // match their name.
    if (dataRow) {
      if (dataRow[dataKey]) {
        const nextValue = String(dataRow[dataKey]).trim();

        switch (column.field) {
          case 'timestamp':
            // normalize the "timestamp" field to ensure the payload works
            additionalConditions[column.field] = getUtcDateString(nextValue);
            break;
          default:
            additionalConditions[column.field] = nextValue;
        }
      }
      // If we have an event, check tags as well.
      if (dataRow && dataRow.tags && dataRow.tags instanceof Array) {
        const tagIndex = dataRow.tags.findIndex(item => item.key === dataKey);
        if (tagIndex > -1) {
          const key = specialKeys.includes(column.field)
            ? `tags[${column.field}]`
            : column.field;
          additionalConditions[key] = dataRow.tags[tagIndex].value;
        }
      }
    }
  });

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

  const parsedQuery = tokenizeSearch(nextView.query);

  // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.
  for (const key in parsedQuery) {
    const column = explodeFieldString(key);
    if (column.aggregation) {
      delete parsedQuery[key];
    }
  }

  // Add additional conditions provided and generated.
  for (const key in additionalConditions) {
    if (key === 'project' || key === 'project.id') {
      nextView.project = [...nextView.project, parseInt(additionalConditions[key], 10)];
      continue;
    }
    if (key === 'environment') {
      nextView.environment = [...nextView.environment, additionalConditions[key]];
      continue;
    }
    const column = explodeFieldString(key);
    // Skip aggregates as they will be invalid.
    if (column.aggregation) {
      continue;
    }
    parsedQuery[key] = [additionalConditions[key]];
  }
  nextView.query = stringifyQueryObject(parsedQuery);

  return nextView;
}

export function getDiscoverLandingUrl(organization: OrganizationSummary): string {
  if (organization.features.includes('discover-query')) {
    return `/organizations/${organization.slug}/discover/queries/`;
  }
  return `/organizations/${organization.slug}/discover/results/`;
}

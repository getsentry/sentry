import {browserHistory} from 'react-router';
import {Location, Query} from 'history';
import Papa from 'papaparse';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  aggregateFunctionOutputType,
  Aggregation,
  AGGREGATIONS,
  Column,
  ColumnType,
  explodeFieldString,
  Field,
  FIELDS,
  getAggregateAlias,
  getEquation,
  isAggregateEquation,
  isEquation,
  isMeasurement,
  isSpanOperationBreakdownField,
  measurementType,
  TRACING_FIELDS,
} from 'sentry/utils/discover/fields';
import {getTitle} from 'sentry/utils/events';
import localStorage from 'sentry/utils/localStorage';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {FieldValue, FieldValueKind, TableColumn} from './table/types';
import {ALL_VIEWS, TRANSACTION_VIEWS, WEB_VITALS_VIEWS} from './data';

export type QueryWithColumnState =
  | Query
  | {
      field: string | string[] | null | undefined;
      sort: string | string[] | null | undefined;
    };

const TEMPLATE_TABLE_COLUMN: TableColumn<string> = {
  key: '',
  name: '',

  type: 'never',
  isSortable: false,

  column: Object.freeze({kind: 'field', field: ''}),
  width: COL_WIDTH_UNDEFINED,
};

// TODO(mark) these types are coupled to the gridEditable component types and
// I'd prefer the types to be more general purpose but that will require a second pass.
export function decodeColumnOrder(fields: Readonly<Field[]>): TableColumn<string>[] {
  let equations = 0;
  return fields.map((f: Field) => {
    const column: TableColumn<string> = {...TEMPLATE_TABLE_COLUMN};

    const col = explodeFieldString(f.field);
    const columnName = f.field;
    if (isEquation(f.field)) {
      column.key = `equation[${equations}]`;
      column.name = getEquation(columnName);
      equations += 1;
    } else {
      column.key = columnName;
      column.name = columnName;
    }
    column.width = f.width || COL_WIDTH_UNDEFINED;

    if (col.kind === 'function') {
      // Aggregations can have a strict outputType or they can inherit from their field.
      // Otherwise use the FIELDS data to infer types.
      const outputType = aggregateFunctionOutputType(col.function[0], col.function[1]);
      if (outputType !== null) {
        column.type = outputType;
      }
      const aggregate = AGGREGATIONS[col.function[0]];
      column.isSortable = aggregate && aggregate.isSortable;
    } else if (col.kind === 'field') {
      if (FIELDS.hasOwnProperty(col.field)) {
        column.type = FIELDS[col.field];
      } else if (isMeasurement(col.field)) {
        column.type = measurementType(col.field);
      } else if (isSpanOperationBreakdownField(col.field)) {
        column.type = 'duration';
      }
    }
    column.column = col;

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

export function generateTitle({
  eventView,
  event,
  organization,
}: {
  eventView: EventView;
  event?: Event;
  organization?: Organization;
}) {
  const titles = [t('Discover')];

  const eventViewName = eventView.name;
  if (typeof eventViewName === 'string' && String(eventViewName).trim().length > 0) {
    titles.push(String(eventViewName).trim());
  }

  const eventTitle = event ? getTitle(event, organization?.features).title : undefined;

  if (eventTitle) {
    titles.push(eventTitle);
  }

  titles.reverse();

  return titles.join(' - ');
}

export function getPrebuiltQueries(organization: Organization) {
  const views = [...ALL_VIEWS];
  if (organization.features.includes('performance-view')) {
    // insert transactions queries at index 2
    views.splice(2, 0, ...TRANSACTION_VIEWS);
    views.push(...WEB_VITALS_VIEWS);
  }

  return views;
}

function disableMacros(value: string | null | boolean | number) {
  const unsafeCharacterRegex = /^[\=\+\-\@]/;

  if (typeof value === 'string' && `${value}`.match(unsafeCharacterRegex)) {
    return `'${value}`;
  }

  return value;
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

  // Make testing easier
  return encodedDataUrl;
}

const ALIASED_AGGREGATES_COLUMN = {
  last_seen: 'timestamp',
  failure_count: 'transaction.status',
};

/**
 * Convert an aggregate into the resulting column from a drilldown action.
 * The result is null if the drilldown results in the aggregate being removed.
 */
function drilldownAggregate(
  func: Extract<Column, {kind: 'function'}>
): Extract<Column, {kind: 'field'}> | null {
  const key = func.function[0];
  const aggregation = AGGREGATIONS[key];
  let column = func.function[1];

  if (ALIASED_AGGREGATES_COLUMN.hasOwnProperty(key)) {
    // Some aggregates are just shortcuts to other aggregates with
    // predefined arguments so we can directly map them to the result.
    column = ALIASED_AGGREGATES_COLUMN[key];
  } else if (aggregation?.parameters?.[0]) {
    const parameter = aggregation.parameters[0];
    if (parameter.kind !== 'column') {
      // The aggregation does not accept a column as a parameter,
      // so we clear the column.
      column = '';
    } else if (!column && parameter.required === false) {
      // The parameter was not given for a non-required parameter,
      // so we fall back to the default.
      column = parameter.defaultValue;
    }
  } else {
    // The aggregation does not exist or does not have any parameters,
    // so we clear the column.
    column = '';
  }
  return column ? {kind: 'field', field: column} : null;
}

/**
 * Convert an aggregated query into one that does not have aggregates.
 * Will also apply additions conditions defined in `additionalConditions`
 * and generate conditions based on the `dataRow` parameter and the current fields
 * in the `eventView`.
 */
export function getExpandedResults(
  eventView: EventView,
  additionalConditions: Record<string, string>,
  dataRow?: TableDataRow | Event
): EventView {
  const fieldSet = new Set();
  // Expand any functions in the resulting column, and dedupe the result.
  // Mark any column as null to remove it.
  const expandedColumns: (Column | null)[] = eventView.fields.map((field: Field) => {
    const exploded = explodeFieldString(field.field);
    const column = exploded.kind === 'function' ? drilldownAggregate(exploded) : exploded;

    if (
      // if expanding the function failed
      column === null ||
      // the new column is already present
      fieldSet.has(column.field) ||
      // Skip aggregate equations, their functions will already be added so we just want to remove it
      isAggregateEquation(field.field)
    ) {
      return null;
    }

    fieldSet.add(column.field);

    return column;
  });

  // id should be default column when expanded results in no columns; but only if
  // the Discover query's columns is non-empty.
  // This typically occurs in Discover drilldowns.
  if (fieldSet.size === 0 && expandedColumns.length) {
    expandedColumns[0] = {kind: 'field', field: 'id'};
  }

  // update the columns according the the expansion above
  const nextView = expandedColumns.reduceRight(
    (newView, column, index) =>
      column === null
        ? newView.withDeletedColumn(index, undefined)
        : newView.withUpdatedColumn(index, column, undefined),
    eventView.clone()
  );

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
): Record<string, string | string[]> {
  const specialKeys = Object.values(URL_PARAM);
  const conditions: Record<string, string | string[]> = {};

  if (!dataRow) {
    return conditions;
  }

  eventView.fields.forEach((field: Field) => {
    const column = explodeFieldString(field.field);

    // Skip aggregate fields
    if (column.kind === 'function') {
      return;
    }

    const dataKey = getAggregateAlias(field.field);
    // Append the current field as a condition if it exists in the dataRow
    // Or is a simple key in the event. More complex deeply nested fields are
    // more challenging to get at as their location in the structure does not
    // match their name.
    if (dataRow.hasOwnProperty(dataKey)) {
      let value = dataRow[dataKey];

      if (Array.isArray(value)) {
        if (value.length > 1) {
          conditions[column.field] = value;
          return;
        }
        // An array with only one value is equivalent to the value itself.
        value = value[0];
      }

      // if the value will be quoted, then do not trim it as the whitespaces
      // may be important to the query and should not be trimmed
      const shouldQuote =
        value === null || value === undefined
          ? false
          : /[\s\(\)\\"]/g.test(String(value).trim());
      const nextValue =
        value === null || value === undefined
          ? ''
          : shouldQuote
          ? String(value)
          : String(value).trim();

      if (isMeasurement(column.field) && !nextValue) {
        // Do not add measurement conditions if nextValue is falsey.
        // It's expected that nextValue is a numeric value.
        return;
      }

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
    if (dataRow.tags && Array.isArray(dataRow.tags)) {
      const tagIndex = dataRow.tags.findIndex(item => item.key === dataKey);
      if (tagIndex > -1) {
        const key = specialKeys.includes(column.field)
          ? `tags[${column.field}]`
          : column.field;

        const tagValue = dataRow.tags[tagIndex].value;
        conditions[key] = tagValue;
      }
    }
  });
  return conditions;
}

function generateExpandedConditions(
  eventView: EventView,
  additionalConditions: Record<string, string>,
  dataRow?: TableDataRow | Event
): string {
  const parsedQuery = new MutableSearch(eventView.query);

  // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.
  for (const key in parsedQuery.filters) {
    const column = explodeFieldString(key);
    if (column.kind === 'function') {
      parsedQuery.removeFilter(key);
    }
  }

  const conditions: Record<string, string | string[]> = Object.assign(
    {},
    additionalConditions,
    generateAdditionalConditions(eventView, dataRow)
  );

  // Add additional conditions provided and generated.
  for (const key in conditions) {
    const value = conditions[key];

    if (Array.isArray(value)) {
      parsedQuery.setFilterValues(key, value);
      continue;
    }

    if (key === 'project.id') {
      eventView.project = [...eventView.project, parseInt(value, 10)];
      continue;
    }
    if (key === 'environment') {
      if (!eventView.environment.includes(value)) {
        eventView.environment = [...eventView.environment, value];
      }
      continue;
    }
    const column = explodeFieldString(key);
    // Skip aggregates as they will be invalid.
    if (column.kind === 'function') {
      continue;
    }

    parsedQuery.setFilterValues(key, [value]);
  }

  return parsedQuery.formatString();
}

type FieldGeneratorOpts = {
  organization: Organization;
  aggregations?: Record<string, Aggregation>;
  fields?: Record<string, ColumnType>;
  measurementKeys?: string[] | null;
  spanOperationBreakdownKeys?: string[];
  tagKeys?: string[] | null;
};

export function generateFieldOptions({
  organization,
  tagKeys,
  measurementKeys,
  spanOperationBreakdownKeys,
  aggregations = AGGREGATIONS,
  fields = FIELDS,
}: FieldGeneratorOpts) {
  let fieldKeys = Object.keys(fields).sort();
  let functions = Object.keys(aggregations);

  // Strip tracing features if the org doesn't have access.
  if (!organization.features.includes('performance-view')) {
    fieldKeys = fieldKeys.filter(item => !TRACING_FIELDS.includes(item));
    functions = functions.filter(item => !TRACING_FIELDS.includes(item));
  }
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  // Index items by prefixed keys as custom tags can overlap both fields and
  // function names. Having a mapping makes finding the value objects easier
  // later as well.
  functions.forEach(func => {
    const ellipsis = aggregations[func].parameters.length ? '\u2026' : '';
    const parameters = aggregations[func].parameters.map(param => {
      const overrides = AGGREGATIONS[func].getFieldOverrides;
      if (typeof overrides === 'undefined') {
        return param;
      }
      return {
        ...param,
        ...overrides({parameter: param}),
      };
    });

    fieldOptions[`function:${func}`] = {
      label: `${func}(${ellipsis})`,
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: func,
          parameters,
        },
      },
    };
  });

  fieldKeys.forEach(field => {
    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: FieldValueKind.FIELD,
        meta: {
          name: field,
          dataType: fields[field],
        },
      },
    };
  });

  if (measurementKeys !== undefined && measurementKeys !== null) {
    measurementKeys.sort();
    measurementKeys.forEach(measurement => {
      fieldOptions[`measurement:${measurement}`] = {
        label: measurement,
        value: {
          kind: FieldValueKind.MEASUREMENT,
          meta: {name: measurement, dataType: measurementType(measurement)},
        },
      };
    });
  }

  if (Array.isArray(spanOperationBreakdownKeys)) {
    spanOperationBreakdownKeys.sort();
    spanOperationBreakdownKeys.forEach(breakdownField => {
      fieldOptions[`span_op_breakdown:${breakdownField}`] = {
        label: breakdownField,
        value: {
          kind: FieldValueKind.BREAKDOWN,
          meta: {name: breakdownField, dataType: 'duration'},
        },
      };
    });
  }

  if (tagKeys !== undefined && tagKeys !== null) {
    tagKeys.sort();
    tagKeys.forEach(tag => {
      const tagValue =
        fields.hasOwnProperty(tag) || AGGREGATIONS.hasOwnProperty(tag)
          ? `tags[${tag}]`
          : tag;
      fieldOptions[`tag:${tag}`] = {
        label: tag,
        value: {
          kind: FieldValueKind.TAG,
          meta: {name: tagValue, dataType: 'string'},
        },
      };
    });
  }

  return fieldOptions;
}

const RENDER_PREBUILT_KEY = 'discover-render-prebuilt';

export function shouldRenderPrebuilt(): boolean {
  const shouldRender = localStorage.getItem(RENDER_PREBUILT_KEY);
  return shouldRender === 'true' || shouldRender === null;
}
export function setRenderPrebuilt(value: boolean) {
  localStorage.setItem(RENDER_PREBUILT_KEY, value ? 'true' : 'false');
}

import Papa from 'papaparse';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';

import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {t} from 'app/locale';
import {Event, LightWeightOrganization, SelectValue, Organization} from 'app/types';
import {getTitle} from 'app/utils/events';
import {getUtcDateString} from 'app/utils/dates';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {disableMacros} from 'app/views/discover/result/utils';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import EventView from 'app/utils/discover/eventView';
import localStorage from 'app/utils/localStorage';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {
  Field,
  Column,
  ColumnType,
  AGGREGATIONS,
  FIELDS,
  aggregateFunctionOutputType,
  explodeFieldString,
  getAggregateAlias,
  TRACING_FIELDS,
  Aggregation,
  isMeasurement,
  measurementType,
} from 'app/utils/discover/fields';

import {ALL_VIEWS, TRANSACTION_VIEWS, WEB_VITALS_VIEWS} from './data';
import {TableColumn, FieldValue, FieldValueKind} from './table/types';

export type QueryWithColumnState =
  | Query
  | {
      field: string | string[] | null | undefined;
      sort: string | string[] | null | undefined;
    };

const TEMPLATE_TABLE_COLUMN: TableColumn<React.ReactText> = {
  key: '',
  name: '',

  type: 'never',
  isSortable: false,

  column: Object.freeze({kind: 'field', field: ''}),
  width: COL_WIDTH_UNDEFINED,
};

// TODO(mark) these types are coupled to the gridEditable component types and
// I'd prefer the types to be more general purpose but that will require a second pass.
export function decodeColumnOrder(
  fields: Readonly<Field[]>
): TableColumn<React.ReactText>[] {
  return fields.map((f: Field) => {
    const column: TableColumn<React.ReactText> = {...TEMPLATE_TABLE_COLUMN};

    const col = explodeFieldString(f.field);
    column.key = f.field;
    column.name = f.field;
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

  const eventTitle = event ? getTitle(event, organization).title : undefined;
  if (eventTitle) {
    titles.push(eventTitle);
  }
  titles.reverse();

  return titles.join(' - ');
}

export function getPrebuiltQueries(organization: LightWeightOrganization) {
  const views = [...ALL_VIEWS];
  if (organization.features.includes('performance-view')) {
    // insert transactions queries at index 2
    views.splice(2, 0, ...TRANSACTION_VIEWS);
  }

  if (organization.features.includes('measurements')) {
    views.push(...WEB_VITALS_VIEWS);
  }

  return views;
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
      // id is implicitly a part of all non-aggregate results
      column.field === 'id' ||
      // the new column is already present
      fieldSet.has(column.field)
    ) {
      return null;
    }

    fieldSet.add(column.field);

    return column;
  });

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
): Record<string, string> {
  const specialKeys = Object.values(URL_PARAM);
  const conditions: Record<string, string> = {};

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
      const value = dataRow[dataKey];
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
  const parsedQuery = tokenizeSearch(eventView.query);

  // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.
  for (const key in parsedQuery.tagValues) {
    const column = explodeFieldString(key);
    if (column.kind === 'function') {
      parsedQuery.removeTag(key);
    }
  }

  const conditions = Object.assign(
    {},
    additionalConditions,
    generateAdditionalConditions(eventView, dataRow)
  );

  // Add additional conditions provided and generated.
  for (const key in conditions) {
    const value = conditions[key];
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

    parsedQuery.setTagValues(key, [conditions[key]]);
  }

  return stringifyQueryObject(parsedQuery);
}

type FieldGeneratorOpts = {
  organization: LightWeightOrganization;
  tagKeys?: string[] | null;
  measurementKeys?: string[] | null;
  aggregations?: Record<string, Aggregation>;
  fields?: Record<string, ColumnType>;
};

export function generateFieldOptions({
  organization,
  tagKeys,
  measurementKeys,
  aggregations = AGGREGATIONS,
  fields = FIELDS,
}: FieldGeneratorOpts) {
  let fieldKeys = Object.keys(fields);
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
      const generator = aggregations[func].generateDefaultValue;
      if (typeof generator === 'undefined') {
        return param;
      }
      return {
        ...param,
        defaultValue: generator({parameter: param, organization}),
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

  if (tagKeys !== undefined && tagKeys !== null) {
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

  if (measurementKeys !== undefined && measurementKeys !== null) {
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

  return fieldOptions;
}

const BANNER_DISMISSED_KEY = 'discover-banner-dismissed';

export function isBannerHidden(): boolean {
  return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}
export function setBannerHidden(value: boolean) {
  localStorage.setItem(BANNER_DISMISSED_KEY, value ? 'true' : 'false');
}

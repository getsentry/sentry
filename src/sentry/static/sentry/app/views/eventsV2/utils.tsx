import Papa from 'papaparse';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';

import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {t} from 'app/locale';
import {Event, Organization, OrganizationSummary, SelectValue} from 'app/types';
import {getTitle} from 'app/utils/events';
import {getUtcDateString} from 'app/utils/dates';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {disableMacros} from 'app/views/discover/result/utils';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import EventView from 'app/utils/discover/eventView';
import {
  Field,
  Column,
  ColumnType,
  AGGREGATIONS,
  FIELDS,
  explodeFieldString,
  getAggregateAlias,
  TRACING_FIELDS,
  Aggregation,
} from 'app/utils/discover/fields';

import {ALL_VIEWS, TRANSACTION_VIEWS} from './data';
import {TableColumn, TableDataRow, FieldValue, FieldValueKind} from './table/types';

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
      const aggregate = AGGREGATIONS[col.function[0]];
      if (aggregate && aggregate.outputType) {
        column.type = aggregate.outputType;
      } else if (FIELDS.hasOwnProperty(col.function[1])) {
        column.type = FIELDS[col.function[1]];
      }
      column.isSortable = aggregate && aggregate.isSortable;
    } else if (col.kind === 'field') {
      column.type = FIELDS[col.field];
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

export function downloadAsCsv(tableData, columnOrder, filename) {
  const {data} = tableData;
  const headings = columnOrder.map(column => column.name);

  const csvContent = Papa.unparse({
    fields: headings,
    data: data.map(row =>
      headings.map(col => {
        col = getAggregateAlias(col);
        // This needs to match the order done in the userBadge component
        if (col === 'user') {
          return disableMacros(
            row['user.name'] ||
              row['user.email'] ||
              row['user.username'] ||
              row['user.ip']
          );
        }
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

// A map between aggregate function names and its un-aggregated form
const TRANSFORM_AGGREGATES = {
  p99: 'transaction.duration',
  p95: 'transaction.duration',
  p75: 'transaction.duration',
  last_seen: 'timestamp',
  latest_event: 'id',
  apdex: '',
  impact: '',
  user_misery: '',
  error_rate: '',
} as const;

/**
 * Convert an aggregated query into one that does not have aggregates.
 * Can also apply additions conditions defined in `additionalConditions`
 * and generate conditions based on the `dataRow` parameter and the current fields
 * in the `eventView`.
 */
export function getExpandedResults(
  eventView: EventView,
  additionalConditions: Record<string, string>,
  dataRow?: TableDataRow | Event
): EventView {
  // Find aggregate fields and flag them for updates.
  const fieldsToUpdate: number[] = [];
  eventView.fields.forEach((field: Field, index: number) => {
    const column = explodeFieldString(field.field);
    if (column.kind === 'function') {
      fieldsToUpdate.push(index);
    }
  });

  let nextView = eventView.clone();
  const transformedFields = new Set();
  const fieldsToDelete: number[] = [];

  // make a best effort to replace aggregated columns with their non-aggregated form
  fieldsToUpdate.forEach((indexToUpdate: number) => {
    const currentField: Field = nextView.fields[indexToUpdate];
    const exploded = explodeFieldString(currentField.field);

    let fieldNameAlias: string = '';
    if (
      exploded.kind === 'function' &&
      TRANSFORM_AGGREGATES.hasOwnProperty(exploded.function[0])
    ) {
      fieldNameAlias = exploded.function[0];
    } else if (exploded.kind === 'field') {
      fieldNameAlias = exploded.field;
    }

    if (
      fieldNameAlias !== undefined &&
      TRANSFORM_AGGREGATES.hasOwnProperty(fieldNameAlias)
    ) {
      const nextFieldName = TRANSFORM_AGGREGATES[fieldNameAlias];
      if (!nextFieldName || transformedFields.has(nextFieldName)) {
        // this field is either duplicated in another column, or nextFieldName is undefined.
        // in either case, we remove this column
        fieldsToDelete.push(indexToUpdate);
        return;
      }
      transformedFields.add(nextFieldName);

      const updatedColumn: Column = {
        kind: 'field',
        field: nextFieldName,
      };
      nextView = nextView.withUpdatedColumn(indexToUpdate, updatedColumn, undefined);

      return;
    }

    if (
      (exploded.kind === 'field' && transformedFields.has(exploded.field)) ||
      (exploded.kind === 'function' && transformedFields.has(exploded.function[1]))
    ) {
      // If we already have this field we can delete the new instance.
      fieldsToDelete.push(indexToUpdate);
      return;
    }

    if (exploded.kind === 'function') {
      let field = exploded.function[1];
      // edge case: transform count() into id
      if (exploded.function[0] === 'count') {
        field = 'id';
      }
      transformedFields.add(field);

      const updatedColumn: Column = {
        kind: 'field',
        field,
      };
      nextView = nextView.withUpdatedColumn(indexToUpdate, updatedColumn, undefined);
    }
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
      const nextValue = value === null || value === undefined ? '' : String(value).trim();

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
  additionalConditions: Record<string, string>,
  dataRow?: TableDataRow | Event
): string {
  const parsedQuery = tokenizeSearch(eventView.query);

  // Remove any aggregates from the search conditions.
  // otherwise, it'll lead to an invalid query result.
  for (const key in parsedQuery) {
    const column = explodeFieldString(key);
    if (column.kind === 'function') {
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
    if (column.kind === 'function') {
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

type FieldGeneratorOpts = {
  organization: OrganizationSummary;
  tagKeys?: string[] | null;
  aggregations?: Record<string, Aggregation>;
  fields?: Record<string, ColumnType>;
};

export function generateFieldOptions({
  organization,
  tagKeys,
  aggregations = AGGREGATIONS,
  fields = FIELDS,
}: FieldGeneratorOpts) {
  let fieldKeys = Object.keys(fields);
  let functions = Object.keys(aggregations);

  // Strip tracing features if the org doesn't have access.
  if (!organization.features.includes('transaction-events')) {
    fieldKeys = fieldKeys.filter(item => !TRACING_FIELDS.includes(item));
    functions = functions.filter(item => !TRACING_FIELDS.includes(item));
  }
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  // Index items by prefixed keys as custom tags can overlap both fields and
  // function names. Having a mapping makes finding the value objects easier
  // later as well.
  functions.forEach(func => {
    const ellipsis = aggregations[func].parameters.length ? '\u2026' : '';
    fieldOptions[`function:${func}`] = {
      label: `${func}(${ellipsis})`,
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: func,
          parameters: [...aggregations[func].parameters],
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

  return fieldOptions;
}

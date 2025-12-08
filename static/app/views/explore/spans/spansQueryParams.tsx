import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateFieldsFromLocation} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateSortBysFromLocation} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCrossEventsFromLocation} from 'sentry/views/explore/queryParams/crossEvent';
import {getCursorFromLocation} from 'sentry/views/explore/queryParams/cursor';
import {getExtrapolateFromLocation} from 'sentry/views/explore/queryParams/extrapolate';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
import {getModeFromLocation} from 'sentry/views/explore/queryParams/mode';
import {getQueryFromLocation} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  getIdFromLocation,
  getTitleFromLocation,
  ID_KEY,
  TITLE_KEY,
} from 'sentry/views/explore/queryParams/savedQuery';
import {getSortBysFromLocation} from 'sentry/views/explore/queryParams/sortBy';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {
  getVisualizesFromLocation,
  isVisualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';
import {SpanFields} from 'sentry/views/insights/types';

const SPANS_MODE_KEY = 'mode';
const SPANS_QUERY_KEY = 'query';
const SPANS_CURSOR_KEY = 'cursor';
const SPANS_FIELD_KEY = 'field';
const SPANS_SORT_KEY = 'sort';
const SPANS_AGGREGATE_FIELD_KEY = 'aggregateField';
export const SPANS_AGGREGATE_CURSOR = 'aggregateCursor';
const SPANS_GROUP_BY_KEY = 'groupBy';
const SPANS_VISUALIZATION_KEY = 'visualize';
const SPANS_AGGREGATE_SORT_KEY = 'aggregateSort';
const SPANS_EXTRAPOLATE_KEY = 'extrapolate';
const SPANS_ID_KEY = ID_KEY;
const SPANS_TITLE_KEY = TITLE_KEY;
const SPANS_CROSS_EVENTS_KEY = 'crossEvents';

export function useSpansDataset(): DiscoverDatasets {
  return DiscoverDatasets.SPANS;
}

export function isDefaultFields(location: Location): boolean {
  return getFieldsFromLocation(location, SPANS_FIELD_KEY) ? false : true;
}

export function getReadableQueryParamsFromLocation(
  location: Location,
  organization: Organization
): ReadableQueryParams {
  const extrapolate = getExtrapolateFromLocation(location, SPANS_EXTRAPOLATE_KEY);
  const mode = getModeFromLocation(location, SPANS_MODE_KEY);
  const query = getQueryFromLocation(location, SPANS_QUERY_KEY) ?? '';

  const cursor = getCursorFromLocation(location, SPANS_CURSOR_KEY);
  const fields =
    getFieldsFromLocation(location, SPANS_FIELD_KEY) ?? defaultFields(organization);
  const sortBys =
    getSortBysFromLocation(location, SPANS_SORT_KEY, fields) ?? defaultSortBys(fields);

  const aggregateCursor = getCursorFromLocation(location, SPANS_AGGREGATE_CURSOR);
  const aggregateFields = getSpansAggregateFieldsFromLocation(location);
  const aggregateSortBys =
    getAggregateSortBysFromLocation(
      location,
      SPANS_AGGREGATE_SORT_KEY,
      aggregateFields
    ) ?? defaultAggregateSortBys(aggregateFields);

  const id = getIdFromLocation(location, SPANS_ID_KEY);
  const title = getTitleFromLocation(location, SPANS_TITLE_KEY);

  const crossEvents = getCrossEventsFromLocation(location, SPANS_CROSS_EVENTS_KEY);

  return new ReadableQueryParams({
    extrapolate,
    mode,
    query,

    cursor,
    fields,
    sortBys,

    aggregateCursor,
    aggregateFields,
    aggregateSortBys,

    id,
    title,

    crossEvents,
  });
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  updateNullableLocation(
    target,
    SPANS_EXTRAPOLATE_KEY,
    defined(writableQueryParams.extrapolate)
      ? writableQueryParams.extrapolate
        ? null
        : '0'
      : writableQueryParams.extrapolate
  );
  updateNullableLocation(target, SPANS_QUERY_KEY, writableQueryParams.query);
  updateNullableLocation(target, SPANS_MODE_KEY, writableQueryParams.mode);

  updateNullableLocation(target, SPANS_FIELD_KEY, writableQueryParams.fields);
  updateNullableLocation(
    target,
    SPANS_SORT_KEY,
    writableQueryParams.sortBys === null
      ? null
      : writableQueryParams.sortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  updateNullableLocation(
    target,
    SPANS_AGGREGATE_FIELD_KEY,
    writableQueryParams.aggregateFields?.map(aggregateField =>
      JSON.stringify(aggregateField)
    )
  );
  updateNullableLocation(
    target,
    SPANS_AGGREGATE_SORT_KEY,
    writableQueryParams.aggregateSortBys === null
      ? null
      : writableQueryParams.aggregateSortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  updateNullableLocation(
    target,
    SPANS_CROSS_EVENTS_KEY,
    writableQueryParams?.crossEvents === null
      ? null
      : JSON.stringify(writableQueryParams.crossEvents)
  );

  return target;
}

function defaultFields(organization: Organization): string[] {
  if (organization.features.includes('performance-otel-friendly-ui')) {
    return [
      SpanFields.ID,
      SpanFields.NAME,
      SpanFields.SPAN_DESCRIPTION,
      SpanFields.SPAN_DURATION,
      SpanFields.TRANSACTION,
      SpanFields.TIMESTAMP,
    ];
  }

  return [
    'id',
    'span.op',
    'span.description',
    'span.duration',
    'transaction',
    'timestamp',
  ];
}

function defaultSortBys(fields: string[]): Sort[] {
  if (fields.includes('timestamp')) {
    return [
      {
        field: 'timestamp',
        kind: 'desc' as const,
      },
    ];
  }

  if (fields.length) {
    return [
      {
        field: fields[0]!,
        kind: 'desc' as const,
      },
    ];
  }

  return [];
}

function defaultGroupBys(): [GroupBy] {
  return [{groupBy: ''}];
}

export function defaultVisualizes(): [Visualize] {
  return [new VisualizeFunction(DEFAULT_VISUALIZATION)];
}

function getSpansAggregateFieldsFromLocation(location: Location): AggregateField[] {
  const aggregateFields = getAggregateFieldsFromLocation(
    location,
    SPANS_AGGREGATE_FIELD_KEY
  );

  if (aggregateFields?.length) {
    let hasGroupBy = false;
    let hasVisualize = false;
    for (const aggregateField of aggregateFields) {
      if (isGroupBy(aggregateField)) {
        hasGroupBy = true;
      } else if (isVisualize(aggregateField)) {
        hasVisualize = true;
      }
    }

    // We have at least 1 group by or 1 visualize, insert some
    // defaults to make sure we have at least 1 of both

    if (!hasGroupBy) {
      aggregateFields.push(...defaultGroupBys());
    }

    if (!hasVisualize) {
      aggregateFields.push(...defaultVisualizes());
    }

    return aggregateFields;
  }

  return [
    ...(getGroupBysFromLocation(location, SPANS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(location, SPANS_VISUALIZATION_KEY) ??
      defaultVisualizes()),
  ];
}

function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
  for (const aggregateField of aggregateFields) {
    if (isVisualize(aggregateField)) {
      return [
        {
          field: aggregateField.yAxis,
          kind: 'desc' as const,
        },
      ];
    }
  }

  for (const aggregateField of aggregateFields) {
    if (isGroupBy(aggregateField)) {
      return [
        {
          field: aggregateField.groupBy,
          kind: 'desc' as const,
        },
      ];
    }
  }

  return [];
}

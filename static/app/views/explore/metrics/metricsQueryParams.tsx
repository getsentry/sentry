import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getAggregateFieldsFromLocation} from 'sentry/views/explore/queryParams/aggregateField';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {getAggregateSortBysFromLocation} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {getCursorFromLocation} from 'sentry/views/explore/queryParams/cursor';
import {getFieldsFromLocation} from 'sentry/views/explore/queryParams/field';
import {
  defaultGroupBys,
  getGroupBysFromLocation,
  isGroupBy,
} from 'sentry/views/explore/queryParams/groupBy';
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
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
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const METRICS_MODE_KEY = 'mode';
const METRICS_QUERY_KEY = 'metricsQuery';
const METRICS_FIELDS_KEY = 'metricsFields';
const METRICS_SORT_BYS_KEY = 'metricsSortBys';
const METRICS_CURSOR_KEY = 'metricsCursor';
const METRICS_AGGREGATE_CURSOR_KEY = 'metricsAggregateCursor';
const METRICS_AGGREGATE_FIELD_KEY = 'aggregateField';
const METRICS_AGGREGATE_SORT_BYS_KEY = 'metricsAggregateSortBys';
const METRICS_GROUP_BY_KEY = 'metricsGroupBy';
const METRICS_AGGREGATE_FN_KEY = 'metricsAggregate';
const METRICS_AGGREGATE_PARAM_KEY = 'metricsAggregateParam';
const METRICS_ID_KEY = ID_KEY;
const METRICS_TITLE_KEY = TITLE_KEY;

function defaultMetricFields(): string[] {
  return ['timestamp', 'metric.name', 'metric.value', 'metric.type'];
}

export function isDefaultFields(location: Location): boolean {
  return getFieldsFromLocation(location, METRICS_FIELDS_KEY) ? false : true;
}

export function getReadableQueryParamsFromLocation(
  location: Location
): ReadableQueryParams {
  // Default to aggregate mode for metrics (different from logs which defaults to samples)
  const modeValue = decodeScalar(location.query?.[METRICS_MODE_KEY]);
  const mode = modeValue === 'samples' ? Mode.SAMPLES : Mode.AGGREGATE;

  // For metrics, the query includes metric_name and metric_type filters
  const query = getQueryFromLocation(location, METRICS_QUERY_KEY) ?? '';

  const cursor = getCursorFromLocation(location, METRICS_CURSOR_KEY);
  const fields =
    getFieldsFromLocation(location, METRICS_FIELDS_KEY) ?? defaultMetricFields();
  const sortBys =
    getSortBysFromLocation(location, METRICS_SORT_BYS_KEY, fields) ??
    defaultSortBys(fields);

  const aggregateCursor = getCursorFromLocation(location, METRICS_AGGREGATE_CURSOR_KEY);
  const aggregateFields = getMetricsAggregateFieldsFromLocation(location);
  const aggregateSortBys =
    getAggregateSortBysFromLocation(
      location,
      METRICS_AGGREGATE_SORT_BYS_KEY,
      aggregateFields
    ) ?? defaultAggregateSortBys(aggregateFields);

  const id = getIdFromLocation(location, METRICS_ID_KEY);
  const title = getTitleFromLocation(location, METRICS_TITLE_KEY);

  return new ReadableQueryParams({
    extrapolate: true,
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
  });
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  updateNullableLocation(target, METRICS_MODE_KEY, writableQueryParams.mode);
  updateNullableLocation(target, METRICS_QUERY_KEY, writableQueryParams.query);

  updateNullableLocation(target, METRICS_CURSOR_KEY, writableQueryParams.cursor);
  updateNullableLocation(target, METRICS_FIELDS_KEY, writableQueryParams.fields);
  updateNullableLocation(
    target,
    METRICS_SORT_BYS_KEY,
    writableQueryParams.sortBys === null
      ? null
      : writableQueryParams.sortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  updateNullableLocation(
    target,
    METRICS_AGGREGATE_CURSOR_KEY,
    writableQueryParams.aggregateCursor
  );
  updateNullableLocation(
    target,
    METRICS_AGGREGATE_FIELD_KEY,
    writableQueryParams.aggregateFields?.map(aggregateField =>
      JSON.stringify(aggregateField)
    )
  );
  updateNullableLocation(
    target,
    METRICS_AGGREGATE_SORT_BYS_KEY,
    writableQueryParams.aggregateSortBys === null
      ? null
      : writableQueryParams.aggregateSortBys?.map(
          sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`
        )
  );

  // when using aggregate fields, we want to make sure to delete the params
  // used by the separate group by, aggregate fn and aggregate param
  if (defined(writableQueryParams.aggregateFields)) {
    delete target.query[METRICS_GROUP_BY_KEY];
    delete target.query[METRICS_AGGREGATE_FN_KEY];
    delete target.query[METRICS_AGGREGATE_PARAM_KEY];
  }

  return target;
}

function defaultSortBys(fields: string[]) {
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

export function defaultVisualizes() {
  return [new VisualizeFunction(`${AggregationKey.COUNT}(metric.value)`)];
}

function getVisualizesFromLocation(location: Location): Visualize[] | null {
  const aggregateFn = decodeScalar(location.query?.[METRICS_AGGREGATE_FN_KEY]);

  if (aggregateFn === AggregationKey.COUNT) {
    return [new VisualizeFunction(`${aggregateFn}(metric.value)`)];
  }

  const aggregateParam = decodeScalar(location.query?.[METRICS_AGGREGATE_PARAM_KEY]);

  if (!aggregateParam) {
    return null;
  }

  return [new VisualizeFunction(`${aggregateFn}(${aggregateParam})`)];
}

function getMetricsAggregateFieldsFromLocation(location: Location): AggregateField[] {
  const aggregateFields = getAggregateFieldsFromLocation(
    location,
    METRICS_AGGREGATE_FIELD_KEY
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

  // TODO: support a list of aggregate fields,
  // needed for re-ordering columns in aggregate mode
  return [
    ...(getGroupBysFromLocation(location, METRICS_GROUP_BY_KEY) ?? defaultGroupBys()),
    ...(getVisualizesFromLocation(location) ?? defaultVisualizes()),
  ];
}

export function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
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

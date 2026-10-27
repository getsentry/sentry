import trimStart from 'lodash/trimStart';

import type {EventsStatsOptions} from 'sentry/actionCreators/events';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toArray} from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  getAggregateAlias,
  getEquationAliasIndex,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets, TOP_N} from 'sentry/utils/discover/types';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {getNumEquations, getWidgetInterval} from 'sentry/views/dashboards/utils';
import {supportsWidgetTransformations} from 'sentry/views/dashboards/utils/transformations';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

const RPC_DATASETS = [
  DiscoverDatasets.OURLOGS,
  DiscoverDatasets.SPANS,
  DiscoverDatasets.TRACEMETRICS,
];

type SeriesQueryFields = {
  yAxis: string | string[];
  excludeOther?: boolean;
  field?: string[];
  orderby?: string;
  topEvents?: number;
};

/**
 * The parts of a series request that depend on the widget query: which
 * aggregates to plot, how to group them, how many groups to return, and how
 * to sort them. Shared by the `/events-stats/` and `/events-timeseries/`
 * request builders below.
 */
function getSeriesQueryFields(
  widget: Widget,
  queryIndex: number,
  dataset: DiscoverDatasets
): SeriesQueryFields {
  const widgetQuery = widget.queries[queryIndex]!;
  const {displayType, limit} = widget;

  if (displayType === DisplayType.TOP_N) {
    const fields: SeriesQueryFields = {
      yAxis: widgetQuery.aggregates[widgetQuery.aggregates.length - 1]!,
      field: [...widgetQuery.columns, ...widgetQuery.aggregates],
      topEvents: TOP_N,
    };
    if (widgetQuery.orderby) {
      fields.orderby = widgetQuery.orderby;
    }
    return fields;
  }

  const fields: SeriesQueryFields = {
    yAxis: widgetQuery.aggregates,
    orderby: widgetQuery.orderby,
  };

  if (widgetQuery.columns?.length === 0) {
    return fields;
  }

  fields.topEvents = limit ?? TOP_N;
  fields.field = [...widgetQuery.columns, ...widgetQuery.aggregates];

  const orderby = trimStart(widgetQuery.orderby, '-');
  if (
    widgetQuery.orderby &&
    !isEquationAlias(orderby) &&
    !fields.field.map(getAggregateAlias).includes(getAggregateAlias(orderby))
  ) {
    fields.field.push(orderby);
  }

  // The "Other" series is only included when there is one y-axis and one
  // widget query
  fields.excludeOther =
    widgetQuery.aggregates.length !== 1 || widget.queries.length !== 1;

  if (RPC_DATASETS.includes(dataset)) {
    if (isEquation(orderby) && !fields.field.includes(orderby)) {
      fields.field = [...widgetQuery.columns, ...widgetQuery.aggregates, orderby];
    } else if (isEquationAlias(orderby)) {
      const equations = widgetQuery.fields?.filter(isEquation) ?? [];
      const equationOrderBy = equations[getEquationAliasIndex(orderby)];
      if (equationOrderBy) {
        fields.orderby = widgetQuery.orderby.startsWith('-')
          ? `-${equationOrderBy}`
          : equationOrderBy;
      }
    }
  } else if (isEquation(orderby)) {
    const nextEquationIndex = getNumEquations(widgetQuery.aggregates);
    const prefix = widgetQuery.orderby.startsWith('-') ? '-' : '';

    // Construct the alias form of the equation and inject it into the request
    fields.orderby = `${prefix}equation[${nextEquationIndex}]`;
    fields.field = [...widgetQuery.columns, ...widgetQuery.aggregates, orderby];
  }

  return fields;
}

/**
 * Builds `/events-stats/` request data for a widget query. Only the
 * transactions and issues widget hooks still use this shape; everything else
 * requests `/events-timeseries/` through `getTimeseriesRequestQuery`.
 */
export function getSeriesRequestData(
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters,
  dataset: DiscoverDatasets,
  referrer?: string,
  widgetInterval?: string
): EventsStatsOptions<true> {
  const widgetQuery = widget.queries[queryIndex]!;
  const {environments, projects} = pageFilters;
  const {start, end, period: statsPeriod} = pageFilters.datetime;
  const interval =
    widgetInterval ?? getWidgetInterval(widget, {start, end, period: statsPeriod}, '1m');

  return {
    organization,
    interval,
    start,
    end,
    project: projects,
    environment: environments,
    period: statsPeriod,
    query: widgetQuery.conditions,
    includePrevious: false,
    referrer,
    partial: true,
    includeAllArgs: true,
    dataset,
    ...getSeriesQueryFields(widget, queryIndex, dataset),
  };
}

type TimeseriesRequestOptions = {
  organization?: Organization;
  referrer?: string;
  sampling?: SamplingMode;
  widgetInterval?: string;
};

type TransformationParams = Record<`transformations[${number}]`, string[]>;

function getAggregatePipelines(
  widget: Widget,
  queryIndex: number,
  organization: Organization | undefined
): Record<number, string[]> {
  const widgetQuery = widget.queries[queryIndex]!;
  if (
    !organization?.features.includes('explore-interpolation-and-smoothing') ||
    !supportsWidgetTransformations(widget.widgetType, widget.displayType)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(widgetQuery.transformations ?? {}).filter(
      ([index, pipeline]) =>
        Number(index) < widgetQuery.aggregates.length &&
        !isEquation(widgetQuery.aggregates[Number(index)]!) &&
        pipeline.length
    )
  );
}

/**
 * Pairs each requested y-axis with its pipeline, dropping repeats of the
 * same y-axis and pipeline, and indexes the pipelines by request position.
 */
function getRequestedSeries(
  yAxis: string[],
  pipelines: Record<number, string[]>
): {transformations: TransformationParams; yAxis: string[]} {
  const requestedYAxis: string[] = [];
  const transformations: TransformationParams = {};
  const seen = new Set<string>();
  yAxis.forEach((axis, index) => {
    const pipeline = pipelines[index] ?? [];
    const key = JSON.stringify([axis, pipeline]);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    if (pipeline.length) {
      transformations[`transformations[${requestedYAxis.length}]`] = pipeline;
    }
    requestedYAxis.push(axis);
  });
  return {yAxis: requestedYAxis, transformations};
}

/**
 * Builds `/events-timeseries/` query params for a widget query.
 */
export function getTimeseriesRequestQuery(
  widget: Widget,
  queryIndex: number,
  pageFilters: PageFilters,
  dataset: DiscoverDatasets,
  {organization, referrer, sampling, widgetInterval}: TimeseriesRequestOptions = {}
) {
  const widgetQuery = widget.queries[queryIndex]!;
  const {environments, projects} = pageFilters;
  const {start, end, period} = pageFilters.datetime;
  const interval =
    widgetInterval ?? getWidgetInterval(widget, {start, end, period}, '1m');
  const {yAxis, field, orderby, topEvents, excludeOther} = getSeriesQueryFields(
    widget,
    queryIndex,
    dataset
  );
  const requestedSeries = getRequestedSeries(
    toArray(yAxis),
    getAggregatePipelines(widget, queryIndex, organization)
  );

  const params = {
    interval,
    ...(period ? {statsPeriod: period} : {}),
    ...(start ? {start: getUtcDateString(start)} : {}),
    ...(end ? {end: getUtcDateString(end)} : {}),
    project: projects,
    environment: environments,
    query: widgetQuery.conditions,
    yAxis: requestedSeries.yAxis,
    groupBy: field,
    field,
    sort: orderby || undefined,
    topEvents,
    excludeOther: excludeOther ? '1' : undefined,
    referrer,
    dataset,
    sampling,
  };
  const query: typeof params & Partial<TransformationParams> = {
    ...params,
    ...requestedSeries.transformations,
  };
  return query;
}

export type TimeseriesRequestQuery = ReturnType<typeof getTimeseriesRequestQuery>;

/**
 * Tags each response series with the pipeline it was requested with, which
 * the response does not include, so transformed duplicates get distinct names.
 */
export function withRequestedTransformations(
  response: EventsTimeSeriesResponse,
  query: TimeseriesRequestQuery
): EventsTimeSeriesResponse {
  const pipelines = query.yAxis.map(
    (_, index) => query[`transformations[${index}]`] ?? []
  );
  if (!pipelines.some(pipeline => pipeline.length)) {
    return response;
  }

  return {
    ...response,
    // Each response group repeats the requested axes in order, without an axis index.
    timeSeries: response.timeSeries.map((timeSeries, index) => ({
      ...timeSeries,
      requestedTransformations: pipelines[index % pipelines.length],
    })),
  };
}

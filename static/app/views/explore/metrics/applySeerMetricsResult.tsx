import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {DateString, PageFilters} from 'sentry/types/core';
import type {Sort} from 'sentry/utils/discover/fields';
import {DEFAULT_YAXIS_BY_TYPE, NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  defaultAggregateSortBys,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  isTraceMetricTypeValue,
  TraceMetricKnownFieldKey,
} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

export interface SeerVisualization {
  chartType: ChartType;
  yAxes: string[];
}

export interface SeerMetricsResult {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
  visualizations: SeerVisualization[];
}

interface ApplySeerMetricsResultParams {
  /**
   * The current panel's metric queries. The entry whose `queryParams` is
   * referentially equal to `queryParams` is the one that gets updated.
   */
  metricQueries: BaseMetricQuery[];
  /**
   * The query params of the panel the Seer result is being applied to.
   */
  queryParams: ReadableQueryParams;
  /**
   * The Seer assisted-query response for a single metric.
   */
  result: SeerMetricsResult;
  /**
   * The page filters selection, used for the datetime fallback when Seer
   * doesn't return its own time range.
   */
  selection: PageFilters;
  /**
   * The currently-selected metric. Preserved when the Seer result doesn't
   * resolve a (valid) metric of its own.
   */
  traceMetric: TraceMetric;
}

interface ApplySeerMetricsResult {
  /**
   * The query with metric.name/type/unit filters stripped (only when a metric
   * was resolved). This is what gets applied to the panel.
   */
  cleanedQuery: string;
  /**
   * The URL-encoded `metric` query param values, one per metric query.
   */
  encodedMetrics: string[];
  groupBys: string[];
  mode: Mode;
  selection: PageFilters;
  visualizeCount: number;
}

/**
 * Pure transform from a Seer metrics assisted-query response into the encoded
 * metric query params (and supporting values) that drive the metrics explore
 * UI. Extracted from the combobox component so it can be unit tested: feed it a
 * Seer result plus the current panel context and assert on the resulting
 * explore query.
 */
export function applySeerMetricsResult({
  result,
  traceMetric,
  queryParams,
  metricQueries,
  selection,
}: ApplySeerMetricsResultParams): ApplySeerMetricsResult {
  const {
    query: queryToUse,
    groupBys,
    statsPeriod,
    start: resultStart,
    end: resultEnd,
    visualizations,
  } = result;

  let start: DateString = null;
  let end: DateString = null;

  if (resultStart && resultEnd) {
    // Strip 'Z' suffix to treat UTC dates as local time
    const startLocal = resultStart.endsWith('Z') ? resultStart.slice(0, -1) : resultStart;
    const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
    start = new Date(startLocal).toISOString();
    end = new Date(endLocal).toISOString();
  } else {
    start = selection.datetime.start;
    end = selection.datetime.end;
  }

  // Update mode based on groupBys or response mode
  const mode =
    groupBys.length > 0
      ? Mode.AGGREGATE
      : result.mode === 'aggregates'
        ? Mode.AGGREGATE
        : Mode.SAMPLES;

  // Convert Seer visualizations to VisualizeFunction objects
  const seerVisualizes = visualizations.flatMap(viz =>
    viz.yAxes.map(yAxis => new VisualizeFunction(yAxis, {chartType: viz.chartType}))
  );

  // Keep the panel's TraceMetric in sync with what Seer queried. We parse
  // the metric name/type/unit out of the visualize aggregate (e.g.
  // p75(value, metric.name, distribution, millisecond)); if it's not there
  // we read metric.name/type/unit filters from the query (typically only
  // present in samples mode).
  const search = new MutableSearch(queryToUse);

  const visualizationTraceMetric = visualizations
    .flatMap(viz => viz.yAxes)
    .map(yAxis => parseMetricAggregate(yAxis).traceMetric)
    .find(metric => metric.name && metric.type && isTraceMetricTypeValue(metric.type));

  const queryMetricName = search.getFilterValues(TraceMetricKnownFieldKey.METRIC_NAME)[0];
  const queryMetricType = search.getFilterValues(TraceMetricKnownFieldKey.METRIC_TYPE)[0];
  const queryMetricUnit = search.getFilterValues(TraceMetricKnownFieldKey.METRIC_UNIT)[0];

  // The metric Seer actually specified, if any. We require a valid metric
  // type and prefer the visualization metric, falling back to the query
  // filters. Left undefined when neither source yields a valid metric — in
  // that case we keep the panel's existing metric untouched rather than
  // guessing a default aggregate.
  let resolvedMetric: TraceMetric | undefined;
  if (visualizationTraceMetric) {
    // parseMetricAggregate leaves unit undefined when the aggregate omits
    // the unit arg; normalize to NONE_UNIT so downstream sample queries keep
    // the same unit scoping as the query-filter path below.
    resolvedMetric = {
      ...visualizationTraceMetric,
      unit: visualizationTraceMetric.unit ?? NONE_UNIT,
    };
  } else if (
    queryMetricName &&
    queryMetricType &&
    isTraceMetricTypeValue(queryMetricType)
  ) {
    resolvedMetric = {
      name: queryMetricName,
      type: queryMetricType,
      unit: queryMetricUnit ?? NONE_UNIT,
    };
  }
  const nextMetric = resolvedMetric ?? traceMetric;

  // Only strip the metric filters from the query when we actually adopted a
  // metric (it's then tracked on the panel, not the query). If we couldn't
  // resolve one, leave the query untouched so it stays consistent with the
  // unchanged panel metric.
  let cleanedQuery = queryToUse;
  if (resolvedMetric) {
    search.removeFilter(TraceMetricKnownFieldKey.METRIC_NAME);
    search.removeFilter(TraceMetricKnownFieldKey.METRIC_TYPE);
    search.removeFilter(TraceMetricKnownFieldKey.METRIC_UNIT);
    cleanedQuery = search.formatString();
  }

  // Build aggregateFields: groupBys first, then visualizes
  const aggregateFields: AggregateField[] = [];

  for (const groupBy of groupBys) {
    aggregateFields.push({groupBy});
  }

  // Apply Seer's visualizes. Seer should return metric-qualified y-axes
  // (e.g. p75(value, metric.name, distribution, millisecond)), which we pass
  // through untouched. Visualize aggregates are always in plain
  // op(value,metric,type,unit) form — conditional `_if` aggregates are
  // normalized to a plain aggregate plus a query filter before reaching a
  // visualize (see parseAggregateExpression) — so re-qualifying never drops
  // a filter argument. Defensively, if a y-axis comes back without a valid
  // metric, we re-qualify it with the resolved metric so the chart stays
  // aligned with the toolbar/samples. In samples mode there's no visualize,
  // so build a default one from the metric's type. When Seer didn't resolve
  // a valid metric, leave the existing visualizes untouched so we don't
  // clobber a customized aggregate.
  if (seerVisualizes.length > 0) {
    for (const viz of seerVisualizes) {
      const {aggregation, traceMetric: vizMetric} = parseMetricAggregate(viz.yAxis);
      const isQualified = Boolean(
        vizMetric.name && vizMetric.type && isTraceMetricTypeValue(vizMetric.type)
      );
      if (!isQualified && resolvedMetric) {
        aggregateFields.push(
          viz.replace({
            yAxis: makeMetricsAggregate({
              aggregate: aggregation,
              traceMetric: resolvedMetric,
            }),
          })
        );
      } else {
        aggregateFields.push(viz);
      }
    }
  } else if (resolvedMetric) {
    const defaultAggregate = DEFAULT_YAXIS_BY_TYPE[resolvedMetric.type];
    if (defaultAggregate) {
      aggregateFields.push(
        new VisualizeFunction(
          makeMetricsAggregate({
            aggregate: defaultAggregate,
            traceMetric: resolvedMetric,
          })
        )
      );
    }
  } else {
    for (const field of queryParams.aggregateFields) {
      if (isVisualize(field)) {
        aggregateFields.push(field);
      }
    }
  }

  // Parse and apply sort from Seer response
  const parseSeerSort = (sortStr: string): Sort => {
    if (sortStr.startsWith('-')) {
      return {field: sortStr.slice(1), kind: 'desc'};
    }
    return {field: sortStr, kind: 'asc'};
  };

  const seerSort = result.sort ? parseSeerSort(result.sort) : undefined;
  const aggregateSortBys =
    mode === Mode.AGGREGATE && seerSort
      ? [seerSort]
      : defaultAggregateSortBys(aggregateFields);
  const sortBys = mode === Mode.SAMPLES && seerSort ? [seerSort] : queryParams.sortBys;

  // Build updated ReadableQueryParams for this metric
  const newQueryParams = queryParams.replace({
    query: cleanedQuery,
    aggregateFields,
    aggregateSortBys,
    sortBys,
    mode,
  });

  // Build encoded metric queries, updating the current metric's query params
  // and trace metric (the metric is parsed out of the agent's visualization
  // aggregate or query filters above so the panel matches what was queried).
  const encodedMetrics = metricQueries
    .map((mq: BaseMetricQuery) => {
      if (mq.queryParams === queryParams) {
        return encodeMetricQueryParams({
          ...mq,
          metric: nextMetric,
          queryParams: newQueryParams,
        });
      }
      return encodeMetricQueryParams(mq);
    })
    .filter(Boolean);

  const nextSelection = {
    ...selection,
    datetime: {
      start,
      end,
      utc: selection.datetime.utc,
      period: resultStart && resultEnd ? null : statsPeriod || selection.datetime.period,
    },
  };

  return {
    encodedMetrics,
    selection: nextSelection,
    cleanedQuery,
    mode,
    groupBys,
    visualizeCount: visualizations.length,
  };
}

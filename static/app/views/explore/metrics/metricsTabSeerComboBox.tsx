import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {
  SeerRawResponse,
  SeerRawResponseItem,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerDateTimeSelection,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Sort} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DEFAULT_YAXIS_BY_TYPE, NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  defaultAggregateSortBys,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  isTraceMetricTypeValue,
  TraceMetricKnownFieldKey,
} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface MetricsTabSeerComboBoxProps {
  traceMetric: TraceMetric;
}

interface Visualization {
  chartType: ChartType;
  yAxes: string[];
}

interface AskSeerSearchQuery {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
  visualizations: Visualization[];
}

function mapResponseItem(r: SeerRawResponseItem): AskSeerSearchQuery {
  return {
    visualizations:
      r.visualization?.map(v => ({
        chartType: v.chart_type as ChartType,
        yAxes: v.y_axes ?? [],
      })) ?? [],
    query: r.query,
    sort: r.sort,
    groupBys: r.group_by ?? [],
    statsPeriod: r.stats_period,
    start: r.start,
    end: r.end,
    mode: r.mode,
  };
}

export function MetricsTabSeerComboBox({traceMetric}: MetricsTabSeerComboBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {setRunId} = useAiQueryContext();
  const organization = useOrganization();
  const queryParams = useQueryParams();
  const metricQueries = useMultiMetricsQueryParams();
  const analyticsArea = useAnalyticsArea();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const metricsTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const user = ConfigStore.get('user');
      const data = await fetchMutation<SeerRawResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjectIdsForMutation,
          strategy: 'Metrics',
          user_email: user?.email,
          options: {
            metric_context: {
              metric_name: traceMetric.name,
              metric_type: traceMetric.type,
              metric_unit: traceMetric.unit ?? NONE_UNIT,
            },
          },
        },
      });

      return {
        status: 'ok',
        unsupported_reason: data.unsupported_reason,
        queries: data.responses.map(mapResponseItem),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery, runId?: number) => {
      if (!result) {
        return;
      }
      const {
        query: queryToUse,
        groupBys,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
        visualizations,
      } = result;

      const dt = buildSeerDateTimeSelection(
        resultStart,
        resultEnd,
        statsPeriod,
        pageFilters.selection.datetime
      );

      const start = dt.start;
      const end = dt.end;

      const mode =
        groupBys.length > 0
          ? Mode.AGGREGATE
          : result.mode === 'aggregates'
            ? Mode.AGGREGATE
            : Mode.SAMPLES;

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
        .find(
          metric => metric.name && metric.type && isTraceMetricTypeValue(metric.type)
        );

      const queryMetricName = search.getFilterValues(
        TraceMetricKnownFieldKey.METRIC_NAME
      )[0];
      const queryMetricType = search.getFilterValues(
        TraceMetricKnownFieldKey.METRIC_TYPE
      )[0];
      const queryMetricUnit = search.getFilterValues(
        TraceMetricKnownFieldKey.METRIC_UNIT
      )[0];

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
      const sortBys =
        mode === Mode.SAMPLES && seerSort ? [seerSort] : queryParams.sortBys;

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
      const newEncodedMetrics = metricQueries
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

      const selection = {
        ...pageFilters.selection,
        datetime: {start, end, utc: dt.utc, period: dt.period},
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: cleanedQuery,
        groupBys,
        mode,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: cleanedQuery,
        group_by_count: groupBys.length,
        visualize_count: visualizations?.length ?? 0,
      });

      if (runId !== undefined) {
        setRunId(runId);
      }

      navigate(
        {
          ...location,
          query: {
            ...location.query,
            metric: newEncodedMetrics,
            start: selection.datetime.start,
            end: selection.datetime.end,
            statsPeriod: selection.datetime.period,
            utc: selection.datetime.utc,
          },
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      metricQueries,
      navigate,
      organization,
      pageFilters.selection,
      queryParams,
      setRunId,
      traceMetric,
    ]
  );

  const usePollingEndpoint =
    organization.features.includes('gen-ai-search-agent-translate') &&
    organization.features.includes('gen-ai-explore-metrics-search');

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(response, mapResponseItem),
    []
  );

  if (!enableAISearch) {
    return null;
  }

  if (usePollingEndpoint) {
    return (
      <AskSeerPollingComboBox<AskSeerSearchQuery>
        initialQuery={initialSeerQuery}
        projectIds={selectedProjectIds}
        strategy="Metrics"
        options={{
          metric_context: {
            metric_name: traceMetric.name,
            metric_type: traceMetric.type,
            metric_unit: traceMetric.unit ?? NONE_UNIT,
          },
        }}
        applySeerSearchQuery={applySeerSearchQuery}
        transformResponse={transformResponse}
        fallbackMutationOptions={metricsTabAskSeerMutationOptions}
      />
    );
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={metricsTabAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
    />
  );
}

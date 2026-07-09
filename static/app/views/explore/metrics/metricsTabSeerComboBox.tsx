import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {
  AskSeerSearchQuery,
  SeerRawResponse,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerMutationResult,
  mapSeerResponseItem,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {resolveSeerProjectSelection} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {DEFAULT_YAXIS_BY_TYPE, NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  defaultAggregateSortBys,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {isTraceMetricTypeValue} from 'sentry/views/explore/metrics/types';
import {
  makeMetricsAggregate,
  parseTraceMetricFromQuery,
  stripTraceMetricTokens,
} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getSeerExploreQuery, getSeerSort} from 'sentry/views/explore/seerQuery';

interface MetricsTabSeerComboBoxProps {
  traceMetric: TraceMetric;
}

export function MetricsTabSeerComboBox({traceMetric}: MetricsTabSeerComboBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {setRunId} = useAiQueryContext();
  const organization = useOrganization();
  const {projects} = useProjects();
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

      return buildSeerMutationResult(data, selectedProjectIds, response =>
        mapSeerResponseItem(response)
      );
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery, runId?: number | string) => {
      if (!result) {
        return;
      }

      const seerQuery = getSeerExploreQuery({
        result,
        pageDatetime: pageFilters.selection.datetime,
      });

      const seerVisualizes = (result.visualizations ?? []).flatMap(viz =>
        viz.yAxes.map(yAxis => new VisualizeFunction(yAxis, {chartType: viz.chartType}))
      );

      // Move any `project:` filter Seer put in the query onto the page-level
      // project selector so it isn't duplicated in the search bar. Metric-filter
      // cleanup below runs on the project-stripped query.
      const {query: projectCleanedQuery, projectIds} = resolveSeerProjectSelection(
        seerQuery.query,
        projects,
        result.expandedProjectIds
      );

      // Keep the panel's TraceMetric in sync with what Seer queried. We prefer
      // the metric parsed out of the visualize aggregate (e.g.
      // p75(value, metric.name, distribution, millisecond)); otherwise we fall
      // back to the metric.name/type/unit filters in the query (samples mode),
      // which parseTraceMetricFromQuery also strips back out for us.
      const visualizationTraceMetric = (result.visualizations ?? [])
        .flatMap(viz => viz.yAxes)
        .map(yAxis => parseMetricAggregate(yAxis).traceMetric)
        .find(
          metric => metric.name && metric.type && isTraceMetricTypeValue(metric.type)
        );

      const {metric: queryTraceMetric} = parseTraceMetricFromQuery(projectCleanedQuery);

      // Prefer the visualization metric (normalizing its unit to NONE_UNIT, since
      // parseMetricAggregate omits the unit arg), falling back to the query-filter
      // metric. Left undefined when neither yields a valid metric — we then keep
      // the panel's existing metric and the query untouched.
      const resolvedMetric = visualizationTraceMetric
        ? {...visualizationTraceMetric, unit: visualizationTraceMetric.unit ?? NONE_UNIT}
        : queryTraceMetric;

      const nextMetric = resolvedMetric ?? traceMetric;

      // Strip the metric identity tokens whenever we adopt a metric (it's tracked
      // on the panel, not the query). Done unconditionally so stale/incomplete
      // metric.* tokens don't linger when the metric came from the visualization
      // aggregate rather than the query. Runs on the project-stripped query.
      const cleanedQuery = resolvedMetric
        ? stripTraceMetricTokens(projectCleanedQuery)
        : projectCleanedQuery;

      const aggregateFields: AggregateField[] = [];

      for (const groupBy of seerQuery.groupBys) {
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

      const seerSort = getSeerSort(seerQuery.sort);
      const aggregateSortBys =
        seerQuery.mode === Mode.AGGREGATE && seerSort
          ? [seerSort]
          : defaultAggregateSortBys(aggregateFields);
      const sortBys =
        seerQuery.mode === Mode.SAMPLES && seerSort ? [seerSort] : queryParams.sortBys;

      const newQueryParams = queryParams.replace({
        query: cleanedQuery,
        aggregateFields,
        aggregateSortBys,
        sortBys,
        mode: seerQuery.mode,
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
        datetime: seerQuery.datetime,
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: cleanedQuery,
        groupBys: seerQuery.groupBys,
        mode: seerQuery.mode,
        interval: seerQuery.interval,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: cleanedQuery,
        group_by_count: seerQuery.groupBys.length,
        visualize_count: seerQuery.visualizes.length,
      });

      if (runId !== undefined) {
        setRunId(runId);
      }

      // Single navigate with both metric params and datetime — previously
      // setQueryParams and navigate were separate calls, and the second
      // navigate overwrote the first with stale location.
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            ...(projectIds?.length ? {project: projectIds.map(String)} : {}),
            metric: newEncodedMetrics,
            start: seerQuery.datetime.start,
            end: seerQuery.datetime.end,
            statsPeriod: seerQuery.datetime.period,
            utc: seerQuery.datetime.utc,
            // Only override the interval when Seer suggested one, otherwise
            // leave the user's current interval untouched.
            ...(seerQuery.interval ? {interval: seerQuery.interval} : {}),
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
      projects,
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
      transformSeerResponse(
        response,
        responseItem => mapSeerResponseItem(responseItem),
        selectedProjectIds
      ),
    [selectedProjectIds]
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

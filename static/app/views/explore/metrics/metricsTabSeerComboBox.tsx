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
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {Sort} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  defaultAggregateSortBys,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
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

      const aggregateFields: AggregateField[] = [];

      for (const groupBy of groupBys) {
        aggregateFields.push({groupBy});
      }

      if (seerVisualizes.length > 0) {
        for (const viz of seerVisualizes) {
          aggregateFields.push(viz);
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
        query: queryToUse,
        aggregateFields,
        aggregateSortBys,
        sortBys,
        mode,
      });

      const newEncodedMetrics = metricQueries
        .map((mq: BaseMetricQuery) => {
          if (mq.queryParams === queryParams) {
            return encodeMetricQueryParams({...mq, queryParams: newQueryParams});
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
        query: queryToUse,
        groupBys,
        mode,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
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

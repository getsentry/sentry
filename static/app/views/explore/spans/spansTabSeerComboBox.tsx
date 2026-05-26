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
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

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

interface TraceAskSeerSearchResponse {
  queries: Array<{
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    stats_period: string;
    visualization: Array<{
      chart_type: number;
      y_axes: string[];
    }>;
  }>;
  status: string;
  unsupported_reason: string | null;
}

function mapResponseItemWithVisualizations(r: SeerRawResponseItem): AskSeerSearchQuery {
  return {
    visualizations:
      r?.visualization?.map(v => ({
        chartType: v?.chart_type as ChartType,
        yAxes: v?.y_axes ?? [],
      })) ?? [],
    query: r?.query ?? '',
    sort: r?.sort ?? '',
    groupBys: r?.group_by ?? [],
    statsPeriod: r?.stats_period ?? '',
    start: r?.start ?? null,
    end: r?.end ?? null,
    mode: r?.mode ?? 'spans',
  };
}

export function SpansTabSeerComboBox() {
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const {setRunId} = useAiQueryContext();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const useTranslateEndpoint = organization.features.includes(
    'gen-ai-search-agent-translate'
  );

  const spansTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      if (useTranslateEndpoint) {
        const data = await fetchMutation<SeerRawResponse>({
          url: `/organizations/${organization.slug}/search-agent/translate/`,
          method: 'POST',
          data: {
            natural_language_query: queryToSubmit,
            project_ids: selectedProjectIdsForMutation,
          },
        });

        return {
          status: 'ok',
          unsupported_reason: data.unsupported_reason,
          queries: data.responses.map(mapResponseItemWithVisualizations),
        };
      }

      const data = await fetchMutation<TraceAskSeerSearchResponse>({
        url: `/organizations/${organization.slug}/trace-explorer-ai/query/`,
        method: 'POST',
        data: {
          natural_language_query: queryToSubmit,
          project_ids: selectedProjectIdsForMutation,
          use_flyout: false,
          limit: 3,
        },
      });

      return {
        ...data,
        queries: data.queries.map(q => ({
          visualizations:
            q?.visualization?.map((v: any) => ({
              chartType: v?.chart_type,
              yAxes: v?.y_axes ?? [],
            })) ?? [],
          query: q?.query,
          sort: q?.sort ?? '',
          groupBys: q?.group_by ?? [],
          statsPeriod: q?.stats_period ?? '',
          start: null,
          end: null,
          mode: q?.mode ?? 'spans',
        })),
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
        visualizations,
        groupBys,
        sort,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      } = result;

      const dt = buildSeerDateTimeSelection(
        resultStart,
        resultEnd,
        statsPeriod,
        pageFilters.selection.datetime
      );

      const start = dt.start;
      const end = dt.end;

      const selection = {
        ...pageFilters.selection,
        datetime: {start, end, utc: dt.utc, period: dt.period},
      };

      const mode =
        groupBys.length > 0
          ? Mode.AGGREGATE
          : result.mode === 'aggregates'
            ? Mode.AGGREGATE
            : Mode.SAMPLES;
      const visualize =
        visualizations?.map((v: Visualization) => ({
          chartType: v.chartType,
          yAxes: v.yAxes,
        })) ?? [];

      const url = getExploreUrl({
        organization,
        selection,
        query: queryToUse,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: queryToUse,
        visualize,
        groupBy: groupBys,
        sort,
        mode,
      });
      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
        group_by_count: groupBys.length,
        visualize_count: visualizations.length,
      });
      if (runId !== undefined) {
        setRunId(runId);
      }
      navigate(url, {replace: true, preventScrollReset: true});
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      navigate,
      organization,
      pageFilters.selection,
      setRunId,
    ]
  );

  useTraceExploreAiQuerySetup({
    enableAISearch: enableAISearch && !useTranslateEndpoint,
  });

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(response, mapResponseItemWithVisualizations),
    []
  );

  if (useTranslateEndpoint) {
    return (
      <AskSeerPollingComboBox<AskSeerSearchQuery>
        initialQuery={initialSeerQuery}
        projectIds={selectedProjectIds}
        strategy="Traces"
        applySeerSearchQuery={applySeerSearchQuery}
        transformResponse={transformResponse}
        fallbackMutationOptions={spansTabAskSeerMutationOptions}
      />
    );
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={spansTabAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
    />
  );
}

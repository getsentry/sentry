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
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {getSeerExploreQuery} from 'sentry/views/explore/seerQuery';
import {getExploreUrl} from 'sentry/views/explore/utils';

interface TraceAskSeerSearchResponse {
  queries: Array<{
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    stats_period: string;
    visualization: Array<{
      chart_type?: number;
      y_axes?: string[];
    }>;
  }>;
  status: string;
  unsupported_reason: string | null;
}

export function SpansTabSeerComboBox() {
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const {projects} = useProjects();
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

        return buildSeerMutationResult(data, selectedProjectIds, response =>
          mapSeerResponseItem(response, 'spans')
        );
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
        queries: data.queries.map(q =>
          mapSeerResponseItem(
            {
              query: q.query,
              sort: q.sort ?? '',
              group_by: q.group_by ?? [],
              stats_period: q.stats_period ?? '',
              start: null,
              end: null,
              mode: q.mode ?? 'spans',
              visualization: q.visualization,
            },
            'spans'
          )
        ),
      };
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

      // Move any `project:` filter Seer put in the query onto the page-level
      // project selector so it isn't duplicated in the search bar.
      const {query: cleanedQuery, projectIds} = resolveSeerProjectSelection(
        seerQuery.query,
        projects,
        result.expandedProjectIds
      );

      const selection = {
        ...pageFilters.selection,
        ...(projectIds?.length ? {projects: projectIds} : {}),
        datetime: seerQuery.datetime,
      };

      // TODO: Include traces mode once we can switch the table in getExploreUrl
      const url = getExploreUrl({
        organization,
        selection,
        query: cleanedQuery,
        visualize: seerQuery.visualizes,
        groupBy: seerQuery.groupBys,
        sort: seerQuery.sort,
        mode: seerQuery.mode,
        interval: seerQuery.interval,
        ...(result.crossEvents?.length ? {crossEvents: result.crossEvents} : {}),
      });

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: cleanedQuery,
        visualize: seerQuery.visualizes,
        groupBy: seerQuery.groupBys,
        sort: seerQuery.sort,
        mode: seerQuery.mode,
        interval: seerQuery.interval,
        ...(result.crossEvents?.length ? {crossEvents: result.crossEvents} : {}),
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
      navigate(url, {replace: true, preventScrollReset: true});
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      navigate,
      organization,
      pageFilters.selection,
      projects,
      setRunId,
    ]
  );

  useTraceExploreAiQuerySetup({
    enableAISearch: enableAISearch && !useTranslateEndpoint,
  });

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(
        response,
        responseItem => mapSeerResponseItem(responseItem, 'spans'),
        selectedProjectIds
      ),
    [selectedProjectIds]
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

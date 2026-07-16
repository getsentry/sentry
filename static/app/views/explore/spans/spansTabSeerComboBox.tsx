import {useCallback} from 'react';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  mapSeerResponseItem,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {resolveSeerProjectSelection} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getSeerExploreQuery} from 'sentry/views/explore/seerQuery';
import {getExploreUrl} from 'sentry/views/explore/utils';

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

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(
        response,
        responseItem => mapSeerResponseItem(responseItem, 'spans'),
        selectedProjectIds
      ),
    [selectedProjectIds]
  );

  if (!enableAISearch) {
    return null;
  }

  return (
    <AskSeerComboBox<AskSeerSearchQuery>
      initialQuery={initialSeerQuery}
      projectIds={selectedProjectIds}
      strategy="Traces"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
    />
  );
}

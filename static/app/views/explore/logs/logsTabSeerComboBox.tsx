import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import type {Location} from 'history';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
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
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {updateNullableLocation} from 'sentry/utils/url/updateNullableLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_CURSOR_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {
  defaultVisualizes,
  LOGS_AGGREGATE_FIELD_KEY,
} from 'sentry/views/explore/logs/logsQueryParams';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  getSeerExploreQuery,
  getSeerWritableAggregateFields,
} from 'sentry/views/explore/seerQuery';

interface LogsSeerLocationQueryResult {
  query: Location['query'];
  seerQuery: ReturnType<typeof getSeerExploreQuery>;
}

export function getLogsSeerLocationQuery({
  currentAggregateFields,
  currentLocation,
  pageDatetime,
  projects = [],
  result,
}: {
  currentAggregateFields: readonly AggregateField[];
  currentLocation: Location;
  pageDatetime: PageFilters['datetime'];
  result: AskSeerSearchQuery;
  projects?: Project[];
}): LogsSeerLocationQueryResult {
  const seerQuery = getSeerExploreQuery({pageDatetime, result});
  const {query: cleanedQuery, projectIds} = resolveSeerProjectSelection(
    seerQuery.query,
    projects,
    result.expandedProjectIds
  );
  const targetLocation: Location = {
    ...currentLocation,
    query: {...currentLocation.query},
  };

  if (projectIds?.length) {
    targetLocation.query.project = projectIds.map(String);
  }

  updateNullableLocation(targetLocation, LOGS_QUERY_KEY, cleanedQuery);
  updateNullableLocation(targetLocation, 'mode', seerQuery.mode);
  updateNullableLocation(
    targetLocation,
    'start',
    seerQuery.datetime.start?.toString() ?? null
  );
  updateNullableLocation(
    targetLocation,
    'end',
    seerQuery.datetime.end?.toString() ?? null
  );
  updateNullableLocation(targetLocation, 'statsPeriod', seerQuery.datetime.period);
  updateNullableLocation(
    targetLocation,
    'utc',
    seerQuery.datetime.utc?.toString() ?? null
  );
  // Only override the interval when Seer suggested one, otherwise leave
  // the user's current interval untouched.
  if (seerQuery.interval) {
    targetLocation.query.interval = seerQuery.interval;
  }
  delete targetLocation.query[LOGS_CURSOR_KEY];
  delete targetLocation.query[LOGS_AGGREGATE_CURSOR_KEY];

  if (seerQuery.mode === Mode.AGGREGATE) {
    const aggregateFields = getSeerWritableAggregateFields({
      currentAggregateFields,
      groupBys: seerQuery.groupBys,
      visualizes: seerQuery.visualizes,
      fallbackVisualizes: defaultVisualizes().map(visualize => visualize.serialize()),
    });
    targetLocation.query[LOGS_AGGREGATE_FIELD_KEY] = aggregateFields.map(field =>
      JSON.stringify(field)
    );
    if (seerQuery.sort) {
      targetLocation.query[LOGS_AGGREGATE_SORT_BYS_KEY] = [seerQuery.sort];
    }
    delete targetLocation.query[LOGS_SORT_BYS_KEY];
  } else {
    if (seerQuery.sort) {
      targetLocation.query[LOGS_SORT_BYS_KEY] = [seerQuery.sort];
    }
    delete targetLocation.query[LOGS_AGGREGATE_SORT_BYS_KEY];
    delete targetLocation.query[LOGS_AGGREGATE_FIELD_KEY];
  }

  return {
    query: targetLocation.query,
    // Reflect the project-stripped query so the suggestion ref and analytics
    // match what actually gets applied to the search bar.
    seerQuery: {...seerQuery, query: cleanedQuery},
  };
}

export function LogsTabSeerComboBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const {projects} = useProjects();
  const queryParams = useQueryParams();
  const analyticsArea = useAnalyticsArea();
  const {setRunId} = useAiQueryContext();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const logsTabAskSeerMutationOptions = mutationOptions({
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
          strategy: 'Logs',
          user_email: user?.email,
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
      const locationQuery = getLogsSeerLocationQuery({
        result,
        currentLocation: location,
        currentAggregateFields: queryParams.aggregateFields,
        projects,
        pageDatetime: {
          start: pageFilters.selection.datetime.start,
          end: pageFilters.selection.datetime.end,
          period: pageFilters.selection.datetime.period,
          utc: pageFilters.selection.datetime.utc,
        },
      });

      const selection = {
        ...pageFilters.selection,
        datetime: locationQuery.seerQuery.datetime,
      };

      askSeerSuggestedQueryRef.current = JSON.stringify({
        selection,
        query: locationQuery.seerQuery.query,
        visualize: locationQuery.seerQuery.visualizes,
        groupBys: locationQuery.seerQuery.groupBys,
        sort: locationQuery.seerQuery.sort,
        mode: locationQuery.seerQuery.mode,
        interval: locationQuery.seerQuery.interval,
      });
      const visualizeCount = result.visualizations?.length ?? 0;

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: locationQuery.seerQuery.query,
        group_by_count: locationQuery.seerQuery.groupBys.length,
        visualize_count: visualizeCount,
      });

      if (runId !== undefined) {
        setRunId(runId);
      }

      navigate(
        {...location, query: locationQuery.query},
        {replace: true, preventScrollReset: true}
      );
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      navigate,
      organization,
      pageFilters.selection,
      projects,
      queryParams.aggregateFields,
      setRunId,
    ]
  );

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

  return (
    <AskSeerPollingComboBox<AskSeerSearchQuery>
      initialQuery={initialSeerQuery}
      projectIds={selectedProjectIds}
      strategy="Logs"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
      fallbackMutationOptions={logsTabAskSeerMutationOptions}
    />
  );
}

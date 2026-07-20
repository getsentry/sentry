import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import omit from 'lodash/omit';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {ALL_DATE_TIME_QUERY_KEYS} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useAiQueryContext} from 'sentry/components/searchQueryBuilder/askSeerCombobox/aiQueryContext';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import type {
  AskSeerSearchQuery,
  SeerRawResponse,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerDateTimeSelection,
  buildSeerMutationResult,
  mapSeerResponseItem,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export function IssueListSeerComboBox() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const {setRunId} = useAiQueryContext();
  const analyticsArea = useAnalyticsArea();
  const {enableAISearch, askSeerSuggestedQueryRef} = useSearchQueryBuilderAI();

  const initialSeerQuery = useInitialSeerQuery();
  const selectedProjectIds = useSelectedProjectIds();
  const selectedProjectIdsForMutation = useSelectedProjectIdsForMutation();

  const transformResponse = useCallback(
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] =>
      transformSeerResponse(
        response,
        responseItem => mapSeerResponseItem(responseItem),
        selectedProjectIds
      ),
    [selectedProjectIds]
  );

  const issueListAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const data = await fetchMutation<SeerRawResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          natural_language_query: queryToSubmit,
          project_ids: selectedProjectIdsForMutation,
          strategy: 'Issues',
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

      const {
        query: queryToUse,
        sort,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
        expandedProjectIds,
      } = result;

      const dt = buildSeerDateTimeSelection(
        resultStart,
        resultEnd,
        statsPeriod,
        pageFilters.selection.datetime
      );
      const timeParams = normalizeDateTimeParams(dt, {allowEmptyPeriod: true});

      askSeerSuggestedQueryRef.current = JSON.stringify({
        query: queryToUse,
        sort,
        ...timeParams,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
      });

      const queryParams = {
        ...omit(location.query, ['page', 'cursor', ...ALL_DATE_TIME_QUERY_KEYS]),
        ...(expandedProjectIds ? {project: expandedProjectIds.map(String)} : {}),
        referrer: 'issue-list',
        query: queryToUse,
        ...(sort ? {sort} : {}),
        ...timeParams,
      };

      if (runId !== undefined) {
        setRunId(runId);
      }

      navigate(
        {
          pathname: location.pathname,
          query: queryParams,
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location.pathname,
      location.query,
      navigate,
      organization,
      pageFilters.selection.datetime,
      setRunId,
    ]
  );

  if (!enableAISearch) {
    return null;
  }

  return (
    <AskSeerPollingComboBox<AskSeerSearchQuery>
      initialQuery={initialSeerQuery}
      projectIds={selectedProjectIds}
      strategy="Issues"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
      fallbackMutationOptions={issueListAskSeerMutationOptions}
    />
  );
}

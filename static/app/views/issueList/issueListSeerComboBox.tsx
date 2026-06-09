import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import omit from 'lodash/omit';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
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
import {useSearchQueryBuilderAI} from 'sentry/components/searchQueryBuilder/context';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export function IssueListSeerComboBox() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
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
    (result: AskSeerSearchQuery, runId?: number) => {
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

      askSeerSuggestedQueryRef.current = JSON.stringify({
        query: queryToUse,
        sort,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
      });

      let timeParams: Record<string, string | undefined> = {};

      if (resultStart && resultEnd) {
        timeParams = {
          start: getUtcDateString(resultStart),
          end: getUtcDateString(resultEnd),
          statsPeriod: undefined,
          // Seer returns absolute ranges as UTC, so display them in UTC to match
          // the suggestion preview the user accepted.
          utc: 'true',
        };
      } else if (statsPeriod) {
        timeParams = {
          statsPeriod,
          start: undefined,
          end: undefined,
          // Clear any utc flag left over from a prior absolute range; a relative
          // window has no UTC display semantics to preserve.
          utc: undefined,
        };
      }

      const queryParams = {
        ...omit(location.query, ['page', 'cursor']),
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

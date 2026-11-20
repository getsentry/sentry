import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
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
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import {useOrganization} from 'sentry/utils/useOrganization';

const seerQueryParsers = {
  cursor: parseAsString,
  end: parseAsString,
  page: parseAsString,
  pageEnd: parseAsString,
  pageStart: parseAsString,
  pageStatsPeriod: parseAsString,
  pageUtc: parseAsString,
  period: parseAsString,
  project: parseAsStringArray,
  query: parseAsString,
  referrer: parseAsString,
  sort: parseAsString,
  start: parseAsString,
  statsPeriod: parseAsString,
  utc: parseAsString,
};

export function IssueListSeerComboBox({className}: {className?: string}) {
  const organization = useOrganization();
  const [, setQueryParams] = useQueryStates(seerQueryParsers, {history: 'replace'});
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
        url: getApiUrl('/organizations/$organizationIdOrSlug/search-agent/translate/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
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

      if (runId !== undefined) {
        setRunId(runId);
      }

      setQueryParams({
        cursor: null,
        page: null,
        pageEnd: null,
        pageStart: null,
        pageStatsPeriod: null,
        pageUtc: null,
        period: null,
        ...(expandedProjectIds ? {project: expandedProjectIds.map(String)} : {}),
        referrer: 'issue-list',
        query: queryToUse,
        ...(sort ? {sort} : {}),
        start: timeParams.start ?? null,
        end: timeParams.end ?? null,
        statsPeriod: timeParams.statsPeriod ?? null,
        utc: timeParams.utc ?? null,
      });
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      organization,
      pageFilters.selection.datetime,
      setQueryParams,
      setRunId,
    ]
  );

  if (!enableAISearch) {
    return null;
  }

  return (
    <AskSeerPollingComboBox<AskSeerSearchQuery>
      className={className}
      initialQuery={initialSeerQuery}
      projectIds={selectedProjectIds}
      strategy="Issues"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
      fallbackMutationOptions={issueListAskSeerMutationOptions}
    />
  );
}

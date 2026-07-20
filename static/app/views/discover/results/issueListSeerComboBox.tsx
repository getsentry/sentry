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
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

interface IssueListSeerComboBoxProps {
  onSearch: (query: string) => void;
}

export function IssueListSeerComboBox({onSearch}: IssueListSeerComboBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const {setRunId} = useAiQueryContext();
  const {askSeerSuggestedQueryRef, enableAISearch} = useSearchQueryBuilderAI();

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
      const user = ConfigStore.get('user');
      const data = await fetchMutation<SeerRawResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjectIdsForMutation,
          strategy: 'Errors',
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
      const {
        query: queryToUse,
        sort,
        groupBys,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
        visualizations,
        expandedProjectIds,
      } = result;

      const dt = buildSeerDateTimeSelection(
        resultStart,
        resultEnd,
        statsPeriod,
        pageFilters.selection.datetime
      );
      const timeParams = normalizeDateTimeParams(dt, {allowEmptyPeriod: true});

      const yAxis =
        visualizations?.length > 0 ? visualizations[0]?.yAxes?.[0] : undefined;

      const columns: string[] = [];
      if (groupBys && groupBys.length > 0) {
        columns.push(...groupBys);
      }
      if (visualizations && visualizations.length > 0) {
        for (const viz of visualizations) {
          if (viz.yAxes && viz.yAxes.length > 0) {
            columns.push(...viz.yAxes);
          }
        }
      }

      askSeerSuggestedQueryRef.current = JSON.stringify({
        query: queryToUse,
        sort,
        ...timeParams,
        yAxis,
        columns,
      });

      trackAnalytics('ai_query.applied', {
        organization,
        area: analyticsArea,
        query: queryToUse,
      });

      onSearch(queryToUse);

      const newQueryParams: Record<string, string | string[] | null | undefined> = {
        ...omit(location.query, ALL_DATE_TIME_QUERY_KEYS),
        ...timeParams,
        query: queryToUse,
      };

      if (expandedProjectIds) {
        newQueryParams.project = expandedProjectIds.map(String);
      }

      // Convert to aliased format for Discover (e.g., "-count()" -> "-count")
      if (sort) {
        const isDescending = sort.startsWith('-');
        const sortField = isDescending ? sort.substring(1) : sort;
        const aliasedSortField = getAggregateAlias(sortField);
        newQueryParams.sort = isDescending ? `-${aliasedSortField}` : aliasedSortField;
      }

      if (yAxis) {
        newQueryParams.yAxis = yAxis;
      }

      if (columns.length > 0) {
        newQueryParams.field = columns;
      }

      if (runId !== undefined) {
        setRunId(runId);
      }

      navigate(
        {...location, query: newQueryParams},
        {replace: true, preventScrollReset: true}
      );
    },
    [
      analyticsArea,
      askSeerSuggestedQueryRef,
      location,
      navigate,
      onSearch,
      pageFilters.selection.datetime,
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
      strategy="Errors"
      applySeerSearchQuery={applySeerSearchQuery}
      transformResponse={transformResponse}
      fallbackMutationOptions={issueListAskSeerMutationOptions}
    />
  );
}

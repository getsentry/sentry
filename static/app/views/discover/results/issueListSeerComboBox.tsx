import {useCallback, useMemo} from 'react';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import ConfigStore from 'sentry/stores/configStore';
import type {DateString} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {ChartType} from 'sentry/views/insights/common/components/chart';

interface AskSeerSearchQuery extends QueryTokensProps {
  end: string | null;
  groupBys: string[];
  mode: string;
  query: string;
  sort: string;
  start: string | null;
  statsPeriod: string;
  visualizations: Array<{chartType: ChartType; yAxes: string[]}>;
}

interface IssuesAskSeerTranslateResponse {
  responses: Array<{
    end: string | null;
    group_by: string[];
    mode: string;
    query: string;
    sort: string;
    start: string | null;
    stats_period: string;
    visualization: Array<{chart_type: number; y_axes: string[]}>;
  }>;
  unsupported_reason: string | null;
}

interface IssueListSeerComboBoxProps {
  onSearch: (query: string) => void;
}

export function IssueListSeerComboBox({onSearch}: IssueListSeerComboBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const {
    currentInputValueRef,
    query,
    committedQuery,
    askSeerSuggestedQueryRef,
    enableAISearch,
  } = useSearchQueryBuilder();

  let initialSeerQuery = '';
  const queryDetails = useMemo(() => {
    const queryToUse = committedQuery.length > 0 ? committedQuery : query;
    const parsedQuery = parseQueryBuilderValue(queryToUse, getFieldDefinition);
    return {parsedQuery, queryToUse};
  }, [committedQuery, query]);

  const inputValue = currentInputValueRef.current.trim();

  // Only filter out FREE_TEXT tokens if there's actual input value to filter by
  const filteredCommittedQuery = queryDetails?.parsedQuery
    ?.filter(
      token =>
        !(token.type === Token.FREE_TEXT && inputValue && token.text.includes(inputValue))
    )
    ?.map(token => stringifyToken(token))
    ?.join(' ')
    ?.trim();

  // Use filteredCommittedQuery if it exists and has content, otherwise fall back to queryToUse
  if (filteredCommittedQuery && filteredCommittedQuery.length > 0) {
    initialSeerQuery = filteredCommittedQuery;
  } else if (queryDetails?.queryToUse) {
    initialSeerQuery = queryDetails.queryToUse;
  }

  if (inputValue) {
    initialSeerQuery =
      initialSeerQuery === '' ? inputValue : `${initialSeerQuery} ${inputValue}`;
  }

  const issueListAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => p.id);

      const user = ConfigStore.get('user');
      const data = await fetchMutation<IssuesAskSeerTranslateResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          strategy: 'Errors',
          user_email: user?.email,
        },
      });

      return {
        status: 'ok',
        unsupported_reason: data.unsupported_reason,
        queries: data.responses.map(r => ({
          query: r?.query ?? '',
          sort: r?.sort ?? '',
          groupBys: r?.group_by ?? [],
          statsPeriod: r?.stats_period ?? '',
          start: r?.start ?? null,
          end: r?.end ?? null,
          mode: r?.mode ?? 'samples',
          visualizations:
            r?.visualization?.map(v => ({
              chartType: v.chart_type as ChartType,
              yAxes: v.y_axes ?? [],
            })) ?? [],
        })),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery) => {
      if (!result) return;
      const {
        query: queryToUse,
        sort,
        groupBys,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
        visualizations,
      } = result;

      let start: DateString = null;
      let end: DateString = null;

      if (resultStart && resultEnd) {
        // Strip 'Z' suffix to treat UTC dates as local time
        const startLocal = resultStart.endsWith('Z')
          ? resultStart.slice(0, -1)
          : resultStart;
        const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
        start = new Date(startLocal).toISOString();
        end = new Date(endLocal).toISOString();
      } else {
        start = pageFilters.selection.datetime.start;
        end = pageFilters.selection.datetime.end;
      }

      // Get yAxis from visualizations
      const yAxis =
        visualizations?.length > 0 ? visualizations[0]?.yAxes?.[0] : undefined;

      // Build columns (field) from groupBys and visualizations
      // Columns should be [groupBy fields..., visualization yAxes...]
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
        statsPeriod,
        start,
        end,
        yAxis,
        columns,
      });

      trackAnalytics('errors.ai_query_applied', {
        organization,
        query: queryToUse,
      });

      // Apply the search query
      onSearch(queryToUse);

      // Build the new query params
      const newQueryParams: Record<string, string | string[] | null | undefined> = {
        ...location.query,
        query: queryToUse,
      };

      // Apply sort if provided - convert to aliased format for Discover
      // e.g., "-count()" -> "-count"
      if (sort) {
        const isDescending = sort.startsWith('-');
        const sortField = isDescending ? sort.substring(1) : sort;
        const aliasedSortField = getAggregateAlias(sortField);
        newQueryParams.sort = isDescending ? `-${aliasedSortField}` : aliasedSortField;
      }

      // Apply yAxis if provided
      if (yAxis) {
        newQueryParams.yAxis = yAxis;
      }

      // Apply columns (field) if we have groupBys or visualizations
      if (columns.length > 0) {
        newQueryParams.field = columns;
      }

      // Apply date range
      if (resultStart && resultEnd) {
        newQueryParams.start = typeof start === 'string' ? start : start?.toISOString();
        newQueryParams.end = typeof end === 'string' ? end : end?.toISOString();
        newQueryParams.statsPeriod = undefined;
      } else if (statsPeriod) {
        newQueryParams.statsPeriod = statsPeriod;
        newQueryParams.start = undefined;
        newQueryParams.end = undefined;
      }

      // Navigate with all params
      navigate(
        {...location, query: newQueryParams},
        {replace: true, preventScrollReset: true}
      );
    },
    [
      askSeerSuggestedQueryRef,
      location,
      navigate,
      onSearch,
      organization,
      pageFilters.selection.datetime,
    ]
  );

  const areAiFeaturesAllowed =
    enableAISearch &&
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features');

  if (!areAiFeaturesAllowed) {
    return null;
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={issueListAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
      analyticsSource="errors"
      feedbackSource="errors_ai_query"
    />
  );
}

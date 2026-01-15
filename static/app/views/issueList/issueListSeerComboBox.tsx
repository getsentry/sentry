import {useCallback, useMemo} from 'react';
import omit from 'lodash/omit';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

interface IssueAskSeerSearchQuery {
  query: string;
  end?: string | null;
  groupBys?: string[];
  sort?: string;
  start?: string | null;
  statsPeriod?: string;
}

interface IssueAskSeerTranslateResponse {
  responses: Array<{
    end: string | null;
    group_by: string[];
    query: string;
    sort: string;
    start: string | null;
    stats_period: string;
  }>;
  unsupported_reason: string | null;
}

/**
 * Component that renders the AI-powered search combobox for the Issues list.
 * Uses the search-agent/translate endpoint with 'Issues' strategy.
 * Navigates directly to apply both query and sort in a single navigation.
 */
export function IssueListSeerComboBox() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentInputValueRef,
    query,
    committedQuery,
    enableAISearch,
    askSeerSuggestedQueryRef,
    parseQuery,
  } = useSearchQueryBuilder();

  let initialSeerQuery = '';
  const queryDetails = useMemo(() => {
    const queryToUse = committedQuery.length > 0 ? committedQuery : query;
    const parsedQuery = parseQuery(queryToUse);
    return {parsedQuery, queryToUse};
  }, [committedQuery, query, parseQuery]);

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

  // Use filteredCommittedQuery if it has content.
  // Only fall back to queryToUse when there's no inputValue to filter by.
  // This prevents duplication when the entire query is free text matching inputValue.
  if (filteredCommittedQuery && filteredCommittedQuery.length > 0) {
    initialSeerQuery = filteredCommittedQuery;
  } else if (!inputValue && queryDetails?.queryToUse) {
    initialSeerQuery = queryDetails.queryToUse;
  }

  if (inputValue) {
    initialSeerQuery =
      initialSeerQuery === '' ? inputValue : `${initialSeerQuery} ${inputValue}`;
  }

  const usePollingEndpoint = organization.features.includes(
    'gen-ai-search-agent-translate'
  );

  // Get selected project IDs for the polling variant
  const selectedProjectIds = useMemo(() => {
    if (
      pageFilters.selection.projects?.length > 0 &&
      pageFilters.selection.projects?.[0] !== -1
    ) {
      return pageFilters.selection.projects;
    }
    return projects.filter(p => p.isMember).map(p => parseInt(p.id, 10));
  }, [pageFilters.selection.projects, projects]);

  // Transform the final_response from Seer to match the expected format
  const transformResponse = useCallback(
    (response: IssueAskSeerSearchQuery): IssueAskSeerSearchQuery[] => {
      const seerResponse = response as unknown as {
        responses?: Array<{
          end: string | null;
          group_by: string[];
          query: string;
          sort: string;
          start: string | null;
          stats_period: string;
        }>;
      };

      if (seerResponse.responses && Array.isArray(seerResponse.responses)) {
        return seerResponse.responses.map(r => ({
          query: r?.query ?? '',
          sort: r?.sort ?? '',
          groupBys: r?.group_by ?? [],
          statsPeriod: r?.stats_period ?? '',
          start: r?.start ?? null,
          end: r?.end ?? null,
        }));
      }

      return [response];
    },
    []
  );

  const issueListAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => p.id);

      const data = await fetchMutation<IssueAskSeerTranslateResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          strategy: 'Issues',
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
        })),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: IssueAskSeerSearchQuery) => {
      if (!result) {
        return;
      }

      const {
        query: queryToUse,
        sort,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      } = result;

      // Store the suggested query for feedback tracking
      askSeerSuggestedQueryRef.current = JSON.stringify({
        query: queryToUse,
        sort,
        statsPeriod,
        start: resultStart,
        end: resultEnd,
      });

      trackAnalytics('issue.list.ai_query_applied', {
        organization,
        query: queryToUse,
      });

      let timeParams: Record<string, string | undefined> = {};

      if (resultStart && resultEnd) {
        // Strip 'Z' suffix to treat UTC dates as local time
        const startLocal = resultStart.endsWith('Z')
          ? resultStart.slice(0, -1)
          : resultStart;
        const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
        timeParams = {
          start: new Date(startLocal).toISOString(),
          end: new Date(endLocal).toISOString(),
          statsPeriod: undefined,
        };
      } else if (statsPeriod) {
        timeParams = {
          statsPeriod,
          start: undefined,
          end: undefined,
        };
      }

      const queryParams = {
        ...omit(location.query, ['page', 'cursor']),
        referrer: 'issue-list',
        query: queryToUse,
        ...(sort ? {sort} : {}),
        ...timeParams,
      };

      navigate(
        {
          pathname: location.pathname,
          query: queryParams,
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [askSeerSuggestedQueryRef, location.pathname, location.query, navigate, organization]
  );

  if (!enableAISearch) {
    return null;
  }

  if (usePollingEndpoint) {
    return (
      <AskSeerPollingComboBox<IssueAskSeerSearchQuery>
        initialQuery={initialSeerQuery}
        projectIds={selectedProjectIds}
        strategy="Issues"
        applySeerSearchQuery={applySeerSearchQuery}
        transformResponse={transformResponse}
        analyticsSource="issue.list"
        feedbackSource="issue_list_ai_query"
        fallbackMutationOptions={issueListAskSeerMutationOptions}
      />
    );
  }

  return (
    <AskSeerComboBox
      initialQuery={initialSeerQuery}
      askSeerMutationOptions={issueListAskSeerMutationOptions}
      applySeerSearchQuery={applySeerSearchQuery}
      analyticsSource="issue.list"
      feedbackSource="issue_list_ai_query"
    />
  );
}

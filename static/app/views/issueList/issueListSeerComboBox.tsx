import {useCallback, useMemo} from 'react';
import omit from 'lodash/omit';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
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

      // Build time range parameters
      let timeParams: Record<string, string | null> = {};

      if (resultStart && resultEnd) {
        // Use absolute time range - strip 'Z' suffix to treat UTC dates as local time
        const startLocal = resultStart.endsWith('Z')
          ? resultStart.slice(0, -1)
          : resultStart;
        const endLocal = resultEnd.endsWith('Z') ? resultEnd.slice(0, -1) : resultEnd;
        timeParams = {
          start: new Date(startLocal).toISOString(),
          end: new Date(endLocal).toISOString(),
          statsPeriod: null, // Clear relative period when using absolute
        };
      } else if (statsPeriod) {
        // Use relative time period
        timeParams = {
          statsPeriod,
          start: null, // Clear absolute times when using relative
          end: null,
        };
      }

      // Navigate directly with query, sort, and time params to avoid race conditions
      const queryParams = {
        ...omit(location.query, ['page', 'cursor']),
        referrer: 'issue-list',
        query: queryToUse,
        ...(sort ? {sort} : {}),
        ...timeParams,
      };

      navigate({
        pathname: location.pathname,
        query: queryParams,
      });
    },
    [askSeerSuggestedQueryRef, location.pathname, location.query, navigate, organization]
  );

  // enableAISearch from context already checks gen-ai-features, hideAiFeatures,
  // and gen-ai-search-agent-translate (set in IssueSearch component)
  if (!enableAISearch) {
    return null;
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

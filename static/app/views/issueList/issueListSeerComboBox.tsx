import {useCallback, useMemo} from 'react';

import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

interface IssueSearchQueryResult {
  query: string;
  sort?: string;
}

interface IssuesSearchAgentResponse {
  responses: IssueSearchQueryResult[];
  unsupported_reason: string | null;
}

interface IssueListSeerComboBoxProps {
  onSearch: (query: string) => void;
  onSortChange?: (sort: string) => void;
}

export function IssueListSeerComboBox({
  onSearch,
  onSortChange,
}: IssueListSeerComboBoxProps) {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const user = ConfigStore.get('user');

  const {
    currentInputValueRef,
    query,
    committedQuery,
    askSeerSuggestedQueryRef,
    enableAISearch,
  } = useSearchQueryBuilder();

  // Build initial query from current input
  const initialSeerQuery = useMemo(() => {
    const queryToUse = committedQuery.length > 0 ? committedQuery : query;
    const inputValue = currentInputValueRef.current.trim();
    const parsedQuery = parseQueryBuilderValue(queryToUse, getFieldDefinition);

    const filteredQuery = parsedQuery
      ?.filter(
        token =>
          !(
            token.type === Token.FREE_TEXT &&
            inputValue &&
            token.text.includes(inputValue)
          )
      )
      ?.map(token => stringifyToken(token))
      ?.join(' ')
      ?.trim();

    if (filteredQuery && filteredQuery.length > 0) {
      return inputValue ? `${filteredQuery} ${inputValue}` : filteredQuery;
    }
    return inputValue || queryToUse;
  }, [committedQuery, query, currentInputValueRef]);

  const issueListAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => parseInt(p.id, 10));

      const data = await fetchMutation<IssuesSearchAgentResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          strategy: 'Issues',
          user_email: user?.email ?? '',
        },
      });

      // Transform response: API returns `responses`, AskSeerComboBox expects `queries`
      return {
        queries: data.responses.map(r => ({
          query: r.query,
          sort: r.sort,
        })),
        status: 'success',
        unsupported_reason: data.unsupported_reason,
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: IssueSearchQueryResult) => {
      if (!result) {
        return;
      }

      askSeerSuggestedQueryRef.current = JSON.stringify(result);

      trackAnalytics('issue.list.ai_query_applied', {
        organization,
        query: result.query,
      });

      // Apply the search query
      onSearch(result.query);

      // Apply sort if provided and callback exists
      if (result.sort && onSortChange) {
        onSortChange(result.sort);
      }
    },
    [askSeerSuggestedQueryRef, onSearch, onSortChange, organization]
  );

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

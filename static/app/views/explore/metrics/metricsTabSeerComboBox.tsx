import {useCallback, useMemo} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerPollingComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerPollingComboBox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import {fetchMutation, mutationOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

interface AskSeerSearchQuery {
  query: string;
}

interface MetricsAskSeerTranslateResponse {
  responses: Array<{
    query: string;
  }>;
  unsupported_reason: string | null;
}

export function MetricsTabSeerComboBox() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const currentQuery = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();
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

  const metricsTabAskSeerMutationOptions = mutationOptions({
    mutationFn: async (queryToSubmit: string) => {
      const selectedProjects =
        pageFilters.selection.projects?.length > 0 &&
        pageFilters.selection.projects?.[0] !== -1
          ? pageFilters.selection.projects
          : projects.filter(p => p.isMember).map(p => p.id);

      const user = ConfigStore.get('user');
      const data = await fetchMutation<MetricsAskSeerTranslateResponse>({
        url: `/organizations/${organization.slug}/search-agent/translate/`,
        method: 'POST',
        data: {
          org_id: organization.id,
          org_slug: organization.slug,
          natural_language_query: queryToSubmit,
          project_ids: selectedProjects,
          strategy: 'Metrics',
          user_email: user?.email,
        },
      });

      return {
        status: 'ok',
        unsupported_reason: data.unsupported_reason,
        queries: data.responses.map(r => ({
          query: r?.query ?? '',
        })),
      };
    },
  });

  const applySeerSearchQuery = useCallback(
    (result: AskSeerSearchQuery) => {
      if (!result) return;

      // Apply the query to the current metric filter
      setQuery(result.query);

      askSeerSuggestedQueryRef.current = JSON.stringify({
        query: result.query,
      });

      trackAnalytics('metrics.ai_query_applied', {
        organization,
        query: result.query,
      });
    },
    [askSeerSuggestedQueryRef, organization, setQuery]
  );

  const areAiFeaturesAllowed =
    enableAISearch &&
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features');

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
    (response: AskSeerSearchQuery): AskSeerSearchQuery[] => {
      const seerResponse = response as unknown as {
        responses?: Array<{
          query: string;
        }>;
      };

      if (seerResponse.responses && Array.isArray(seerResponse.responses)) {
        return seerResponse.responses.map(r => ({
          query: r?.query ?? '',
        }));
      }

      return [response];
    },
    []
  );

  if (!areAiFeaturesAllowed) {
    return null;
  }

  if (usePollingEndpoint) {
    return (
      <AskSeerPollingComboBox<AskSeerSearchQuery>
        initialQuery={initialSeerQuery}
        onApplySearchQuery={applySeerSearchQuery}
        strategy="Metrics"
        projectIds={selectedProjectIds}
        transformResponse={transformResponse}
      />
    );
  }

  return (
    <AskSeerComboBox<AskSeerSearchQuery>
      initialQuery={initialSeerQuery}
      onApplySearchQuery={applySeerSearchQuery}
      mutationOptions={metricsTabAskSeerMutationOptions}
    />
  );
}

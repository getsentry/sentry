import {parseAsString, useQueryState} from 'nuqs';

import {useAgentFilter} from 'sentry/views/insights/pages/agents/hooks/useAgentFilter';

/**
 * Combines a base query with the agent filter from the URL and the search query from the URL.
 * Agent filter is automatically included when agents are selected in the URL.
 *
 * @param baseQuery - The base query to combine with agent filter and URL query.
 * @returns The combined query.
 */
export function useCombinedQuery(baseQuery = '') {
  const {agentQuery} = useAgentFilter();
  const [query] = useQueryState('query', parseAsString.withDefault(''));

  const baseWithAgent = [baseQuery, agentQuery].filter(Boolean).join(' ');

  if (!query) {
    return baseWithAgent;
  }

  if (!baseWithAgent) {
    return query;
  }

  return `(${baseWithAgent}) and (${query})`.trim();
}

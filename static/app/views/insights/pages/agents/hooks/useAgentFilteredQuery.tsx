import {useAgentFilter} from 'sentry/views/insights/pages/agents/hooks/useAgentFilter';

/**
 * Combines a base query with the agent filter from the URL.
 * Use this hook in pages that have an AgentSelector UI component.
 *
 * @param baseQuery - The base query to combine with agent filter.
 * @returns The combined query string with agent filter applied.
 */
export function useAgentFilteredQuery(baseQuery = '') {
  const {agentQuery} = useAgentFilter();

  return [baseQuery, agentQuery].filter(Boolean).join(' ');
}

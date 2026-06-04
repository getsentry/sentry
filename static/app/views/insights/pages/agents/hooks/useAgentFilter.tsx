import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {getAgentNamesFilter} from 'sentry/views/insights/pages/agents/utils/query';

/**
 * Hook to read the agent filter from the URL and generate a query string.
 * Returns an empty string if no agents are selected.
 */
export function useAgentFilter() {
  const [agentFilters] = useQueryState(
    'agent',
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const agentQuery = getAgentNamesFilter(agentFilters);

  return {agentQuery};
}

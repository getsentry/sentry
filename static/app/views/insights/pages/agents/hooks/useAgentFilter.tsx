import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {escapeDoubleQuotes} from 'sentry/utils';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Hook to read the agent filter from the URL and generate a query string.
 * Returns an empty string if no agents are selected.
 */
export function useAgentFilter() {
  const [agentFilters] = useQueryState(
    'agent',
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const agentQuery =
    agentFilters.length > 0
      ? `${SpanFields.GEN_AI_AGENT_NAME}:[${agentFilters
          .map(v => `"${escapeDoubleQuotes(v)}"`)
          .join(', ')}]`
      : '';

  return {agentQuery};
}

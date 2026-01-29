import {escapeDoubleQuotes} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Hook to read the agent filter from the URL and generate a query string.
 * Returns an empty string if no agents are selected.
 */
export function useAgentFilter() {
  const {agent: agentFilters = []} = useLocationQuery({
    fields: {agent: decodeList},
  });

  const agentQuery =
    agentFilters.length > 0
      ? `${SpanFields.GEN_AI_AGENT_NAME}:[${agentFilters.map(a => `"${escapeDoubleQuotes(a)}"`).join(',')}]`
      : '';

  return {agentQuery};
}

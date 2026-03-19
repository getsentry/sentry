import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getAgentRunsFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

/**
 * Checks if there are any agent runs in the current page filter selection.
 * Used to determine whether to show agent-level metrics or fall back to
 * all AI span metrics in the runs and duration widgets.
 */
export function useHasAgentRuns(): boolean | undefined {
  const agentRunsRequest = useSpans(
    {
      search: getAgentRunsFilter(),
      fields: ['id'],
      limit: 1,
    },
    Referrer.AGENT_RUNS_WIDGET
  );

  if (agentRunsRequest.isLoading) {
    return undefined;
  }

  return agentRunsRequest.data?.length > 0;
}

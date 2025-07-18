import type {
  FlowDefinition,
  FlowDefinitionWithInstances,
  FlowInstance,
} from 'sentry/views/codecov/flows/types';

export interface FlowApiResponse {
  data: FlowDefinitionWithInstances;
}

export function useGetFlowById(_flowId: string) {
  // TODO - call GET /organizations/{slug}/flows/{flowId}/
}

function generateFakeInstancesWithReplayIds(
  flowId: string,
  replaySlugs: string[]
): FlowInstance[] {
  const now = Date.now();
  return replaySlugs.slice(0, 3).map((replaySlug, idx) => {
    const base = now - 1000 * 60 * 60 * (2 - idx);
    return {
      id: `${flowId}-instance-${idx + 1}`,
      flowId,
      startedAt: new Date(base).toISOString(),
      status: idx === 0 ? 'completed' : idx === 1 ? 'running' : 'failed',
      completedAt:
        idx === 0
          ? new Date(base + 1000 * 60 * 30).toISOString()
          : idx === 2
            ? new Date(base + 1000 * 60 * 10).toISOString()
            : undefined,
      currentStep: `step-${idx + 1}`,
      data: {
        replaySlug,
        ...(idx === 2 ? {error: 'Something went wrong'} : {}),
      },
    };
  });
}

export function useGetFlowByIdTemp(flowId: string) {
  // Mimic the API response structure
  function getFlowFromLocalStorage(id: string): FlowDefinition | null {
    try {
      const stored = localStorage.getItem('flows');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.data)) {
          return parsed.data.find((flow: FlowDefinition) => flow.id === id) || null;
        }
      }
    } catch (e) {
      // Ignore parse errors, return null
    }
    return null;
  }

  const flow = flowId ? getFlowFromLocalStorage(flowId) : null;

  // Add fake instances with replay ids if flow exists
  let flowWithInstances: FlowDefinitionWithInstances | null = null;
  if (flow) {
    // Try to get replay slugs from metadata
    let replaySlugs: string[] = [];
    if (flow.metadata && Array.isArray((flow.metadata as any).replaySlugs)) {
      replaySlugs = (flow.metadata as any).replaySlugs;
    } else if (flow.metadata && (flow.metadata as any).replaySlug) {
      replaySlugs = [(flow.metadata as any).replaySlug];
    } else if ((flow as any).sourceReplaySlug) {
      replaySlugs = [(flow as any).sourceReplaySlug];
    } else {
      // fallback: generate some fake replay slugs
      replaySlugs = [`${flowId}-replay-1`, `${flowId}-replay-2`, `${flowId}-replay-3`];
    }

    flowWithInstances = {
      ...flow,
      instances: generateFakeInstancesWithReplayIds(flow.id, replaySlugs),
    };
  }

  return {
    flow: flowWithInstances,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: () => {}, // No-op for local storage
  };
}

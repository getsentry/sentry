import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

export interface FlowApiResponse {
  data: FlowDefinition;
}

export function useGetFlowById(flowId: string) {
  const organization = useOrganization();

  const {data, isLoading, isError, error, refetch} = useApiQuery<FlowApiResponse>(
    [`/organizations/${organization.slug}/flows/${flowId}/`],
    {
      staleTime: 30000,
      enabled: !!organization.slug && !!flowId,
    }
  );

  return {
    flow: data?.data || null,
    isLoading,
    isError,
    error,
    refetch,
  };
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

  // Mimic the API hook return shape
  return {
    flow,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: () => {}, // No-op for local storage
  };
}

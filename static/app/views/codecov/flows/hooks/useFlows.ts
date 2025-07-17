import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

// API Response Types
export interface FlowsApiResponse {
  data: FlowDefinition[];
  // Add pagination info if your API supports it
  hasMore?: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export function useFlows() {
  const organization = useOrganization();

  // List flows
  const {data, isLoading, isError, error, refetch} = useApiQuery<FlowsApiResponse>(
    [`/organizations/${organization.slug}/flows/`],
    {
      staleTime: 30000,
      enabled: !!organization.slug,
    }
  );

  return {
    data: data?.data ?? [],
    isLoading,
    isError,
    error,
    refetch,
  };
}

export function useFlowsTemp() {
  // This version pulls flows from local storage instead of the API
  function getFlowsFromLocalStorage(): FlowsApiResponse {
    try {
      const stored = localStorage.getItem('flows');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure the structure matches FlowsApiResponse
        return {
          data: Array.isArray(parsed.data) ? parsed.data : [],
          hasMore: parsed.hasMore,
          nextCursor: parsed.nextCursor,
          prevCursor: parsed.prevCursor,
        };
      }
    } catch (e) {
      // Ignore parse errors, return empty
    }
    return {data: []};
  }

  const flowsResponse = getFlowsFromLocalStorage();

  return {
    data: flowsResponse.data,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: () => {}, // No-op, since this is local storage
  };
}

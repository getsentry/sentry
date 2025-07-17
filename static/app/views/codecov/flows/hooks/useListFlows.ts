import type {PageFilters} from 'sentry/types/core';
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

export interface UseFlowsOptions {
  pageFilters?: PageFilters;
}

export function useListFlows(options: UseFlowsOptions = {}) {
  const organization = useOrganization();
  const {pageFilters} = options;

  // Build query parameters from page filters
  const queryParams = new URLSearchParams();

  if (pageFilters?.projects?.length) {
    pageFilters.projects.forEach(projectId => {
      queryParams.append('project', projectId.toString());
    });
  }

  if (pageFilters?.environments?.length) {
    pageFilters.environments.forEach(env => {
      queryParams.append('environment', env);
    });
  }

  const queryString = queryParams.toString();
  const url = queryString
    ? `/organizations/${organization.slug}/flows/?${queryString}`
    : `/organizations/${organization.slug}/flows/`;

  // List flows
  const {data, isLoading, isError, error, refetch} = useApiQuery<FlowsApiResponse>(
    [url],
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

export function useListFlowsTemp(options: UseFlowsOptions = {}) {
  const {pageFilters} = options;

  // This version pulls flows from local storage instead of the API
  function getFlowsFromLocalStorage(): FlowsApiResponse {
    try {
      const stored = localStorage.getItem('flows');
      if (stored) {
        const parsed = JSON.parse(stored);
        let flows = Array.isArray(parsed.data) ? parsed.data : [];

        // Filter by projects if specified
        if (pageFilters?.projects?.length) {
          flows = flows.filter((flow: FlowDefinition) => {
            // Check if flow has project information
            const flowProjectId = flow.projectId || flow.metadata?.projectId;
            return flowProjectId && pageFilters.projects.includes(Number(flowProjectId));
          });
        }

        // Filter by environments if specified
        if (pageFilters?.environments?.length) {
          flows = flows.filter((flow: FlowDefinition) => {
            // Check if flow has environment information
            const flowEnvironment = flow.environment || flow.metadata?.environment;
            return flowEnvironment && pageFilters.environments.includes(flowEnvironment);
          });
        }

        return {
          data: flows,
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

import type {PageFilters} from 'sentry/types/core';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

export interface ListFlowsApiResponse {
  data: FlowDefinition[];
  hasMore?: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface UseListFlowsOptions {
  pageFilters?: PageFilters;
}

export function useListFlows(options: UseListFlowsOptions = {}) {
  // TODO - call GET /organizations/{slug}/flows/
  // query params: page, per_page, project, environment, sort
}

export function useListFlowsTemp(options: UseListFlowsOptions = {}) {
  const {pageFilters} = options;

  // This version pulls flows from local storage instead of the API
  function getFlowsFromLocalStorage(): ListFlowsApiResponse {
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

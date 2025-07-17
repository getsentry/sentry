import type {PageFilters} from 'sentry/types/core';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  CreateFlowApiRequest,
  CreateFlowApiResponse,
  FlowsApiResponse,
} from 'sentry/views/codecov/flows/types';

export interface UseCreateFlowOptions {
  pageFilters?: PageFilters;
}

export function useCreateFlow(options: UseCreateFlowOptions = {}) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {pageFilters} = options;

  return useMutation<CreateFlowApiResponse, any, CreateFlowApiRequest>({
    mutationFn: (flowData: CreateFlowApiRequest) => {
      const enrichedFlowData = {
        ...flowData,
        projectId: flowData.projectId || pageFilters?.projects?.[0] || undefined,
        environment: flowData.environment || pageFilters?.environments?.[0] || undefined,
      };

      return api.requestPromise(`/organizations/${organization.slug}/flows/`, {
        method: 'POST',
        data: enrichedFlowData,
      });
    },
    onSuccess: (response: CreateFlowApiResponse) => {
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/${organization.slug}/flows/`],
        (oldData: FlowsApiResponse | undefined) => ({
          ...oldData,
          data: [...(oldData?.data || []), response.data],
        })
      );
    },
  });
}


export function useCreateFlowTemp(options: UseCreateFlowOptions = {}) {
  const queryClient = useQueryClient();
  const {pageFilters} = options;

  return useMutation<CreateFlowApiResponse, any, CreateFlowApiRequest>({
    mutationFn: async (flowData: CreateFlowApiRequest) => {
      const projectId = flowData.projectId || pageFilters?.projects?.[0] || undefined;
      const environment =
        flowData.environment || pageFilters?.environments?.[0] || undefined;

      const newFlow = {
        ...flowData,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: flowData.status || 'active',
        createdBy: flowData.createdBy || {
          id: 'local-user',
          name: 'Local User',
          email: 'local@example.com',
          avatarUrl: '',
        },
        version: '1',
        steps: flowData.steps || [],
        projectId,
        environment,
        metadata: {
          projectId,
          environment,
          replayId: flowData.replayId,
          startBreadcrumb: flowData.startBreadcrumb,
          endBreadcrumb: flowData.endBreadcrumb,
        },
      };

      // Read current flows from localStorage
      let flowsObj = {data: []};
      try {
        const stored = localStorage.getItem('flows');
        if (stored) {
          flowsObj = JSON.parse(stored);
          if (!Array.isArray(flowsObj.data)) {
            flowsObj.data = [];
          }
        }
      } catch (e) {
        flowsObj = {data: []};
      }

      // Add new flow
      flowsObj.data.push(newFlow);

      // Write back to localStorage
      localStorage.setItem('flows', JSON.stringify(flowsObj));

      // Return a response-like object
      return {data: newFlow};
    },
    onSuccess: (response: CreateFlowApiResponse) => {
      // Update the query cache for localStorage flows
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/local/flows/`],
        (oldData: FlowsApiResponse | undefined) => ({
          ...oldData,
          data: [...(oldData?.data || []), response.data],
        })
      );
    },
  });
}

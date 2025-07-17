import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {FlowsApiResponse} from 'sentry/views/codecov/flows/types';


export function useDeleteFlow() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<void, any, string>({
    mutationFn: (flowId: string) =>
      api.requestPromise(`/organizations/${organization.slug}/flows/${flowId}/`, {
        method: 'DELETE',
      }),
    onSuccess: (_, flowId: string) => {
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/${organization.slug}/flows/`],
        (oldData: FlowsApiResponse | undefined) => ({
          ...oldData,
          data: (oldData?.data || []).filter((flow: any) => flow.id !== flowId),
        })
      );
    },
  });
}


export function useDeleteFlowTemp() {
  const queryClient = useQueryClient();

  return useMutation<void, any, string>({
    mutationFn: async (flowId: string) => {
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

      // Remove the flow with the given id
      flowsObj.data = (flowsObj.data || []).filter((flow: any) => flow.id !== flowId);

      // Write back to localStorage
      localStorage.setItem('flows', JSON.stringify(flowsObj));
    },
    onSuccess: (_, flowId: string) => {
      // Update the query cache for localStorage flows
      queryClient.setQueryData<FlowsApiResponse>(
        [`/organizations/local/flows/`],
        (oldData: FlowsApiResponse | undefined) => ({
          ...oldData,
          data: (oldData?.data || []).filter((flow: any) => flow.id !== flowId),
        })
      );
    },
  });
}

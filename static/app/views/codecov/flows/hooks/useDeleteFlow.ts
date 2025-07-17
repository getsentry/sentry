import {useMutation, useQueryClient} from 'sentry/utils/queryClient';

import type {ListFlowsApiResponse} from 'sentry/views/codecov/flows/hooks/useListFlows';

export function useDeleteFlow() {
  // TODO - call DELETE /organizations/{slug}/flows/{flowId}/
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
      queryClient.setQueryData<ListFlowsApiResponse>(
        [`/organizations/local/flows/`],
        (oldData: ListFlowsApiResponse | undefined) => ({
          ...oldData,
          data: (oldData?.data || []).filter((flow: any) => flow.id !== flowId),
        })
      );
    },
  });
}

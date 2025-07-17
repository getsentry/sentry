import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {CreateFlowApiRequest, CreateFlowApiResponse, FlowsApiResponse} from '../types';

/**
 * Custom hook to create a new flow.
 */
export function useCreateFlow() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<CreateFlowApiResponse, any, CreateFlowApiRequest>({
    mutationFn: (flowData: CreateFlowApiRequest) =>
      api.requestPromise(`/organizations/${organization.slug}/flows/`, {
        method: 'POST',
        data: flowData,
      }),
    onSuccess: (response: CreateFlowApiResponse) => {
      // Optimistically update the cache
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

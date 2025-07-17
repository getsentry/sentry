import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {FlowsApiResponse} from '../types';

/**
 * Custom hook to delete a flow.
 */
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
      // Optimistically update the cache
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

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t, tct} from 'sentry/locale';
import {
  useApiQuery,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {
  ProviderLabels,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/types';

const makeDataForwarderQueryKey = (params: {orgSlug: string}): ApiQueryKey => [
  `/organizations/${params.orgSlug}/forwarding/`,
];

function useDataForwarders({
  params,
  options,
}: {
  params: {orgSlug: string};
  options?: Partial<UseApiQueryOptions<DataForwarder[]>>;
}) {
  return useApiQuery<DataForwarder[]>(makeDataForwarderQueryKey(params), {
    staleTime: 30000,
    ...options,
  });
}

/**
 * Simplified hook to get the primary data forwarder for an organization.
 */
export function useDataForwarder({
  orgSlug,
}: {
  orgSlug: string;
}): DataForwarder | undefined {
  const {data: dataForwarders = []} = useDataForwarders({params: {orgSlug}});
  return dataForwarders[0];
}

const makeDataForwarderMutationQueryKey = (params: {
  dataForwarderId: string;
  orgSlug: string;
}): ApiQueryKey => [
  `/organizations/${params.orgSlug}/forwarding/${params.dataForwarderId}/`,
];

/**
 * Mutate a DataForwarder. If an ID is provided, it will be updated otherwise a new one will be created.
 */
export function useMutateDataForwarder({
  params: {orgSlug, dataForwarderId},
}: {
  params: {orgSlug: string; dataForwarderId?: string};
}) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  const method = dataForwarderId ? 'PUT' : 'POST';
  const listQueryKey = makeDataForwarderQueryKey({orgSlug});
  const [endpoint] = dataForwarderId
    ? makeDataForwarderMutationQueryKey({dataForwarderId, orgSlug})
    : listQueryKey;
  return useMutation<DataForwarder, RequestError, DataForwarder>({
    mutationFn: data => api.requestPromise(endpoint, {method, data}),
    onSuccess: (dataForwarder: DataForwarder) => {
      addSuccessMessage(
        tct('[provider] data forwarder [action]', {
          provider: ProviderLabels[dataForwarder.provider],
          action: dataForwarderId ? t('updated') : t('created'),
        })
      );
      queryClient.invalidateQueries({queryKey: [endpoint]});
      queryClient.invalidateQueries({queryKey: listQueryKey});
    },
    onError: error => {
      const displayError =
        JSON.stringify(error.responseJSON) ?? t('Failed to update data forwarder');
      addErrorMessage(displayError);
    },
  });
}

export function useDeleteDataForwarder({
  params,
}: {
  params: {dataForwarderId: string; orgSlug: string};
}) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  return useMutation<void, RequestError, {dataForwarderId: string; orgSlug: string}>({
    mutationFn: ({dataForwarderId, orgSlug}) =>
      api.requestPromise(
        makeDataForwarderMutationQueryKey({dataForwarderId, orgSlug})[0],
        {method: 'DELETE'}
      ),
    onSuccess: () => {
      addSuccessMessage(t('Data forwarder deleted'));
      queryClient.invalidateQueries({queryKey: makeDataForwarderQueryKey(params)});
    },
    onError: _error => {
      addErrorMessage(t('Failed to delete data forwarder'));
    },
  });
}

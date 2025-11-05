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
import useOrganization from 'sentry/utils/useOrganization';
import type {DataForwarder} from 'sentry/views/settings/organizationDataForwarding/types';

export function useHasDataForwardingAccess() {
  const organization = useOrganization();
  const featureSet = new Set(organization.features);

  return (
    // Can access the new UI/UX and endpoints
    featureSet.has('data-forwarding-revamp-access') &&
    // Can access the feature itself (subscription-based)
    featureSet.has('data-forwarding')
  );
}

const makeDataForwarderQueryKey = (params: {orgSlug: string}): ApiQueryKey => [
  `/organizations/${params.orgSlug}/data-forwarders/`,
];

export function useDataForwarders({
  params,
  options,
}: {
  options: Partial<UseApiQueryOptions<DataForwarder[]>>;
  params: {orgSlug: string};
}) {
  return useApiQuery<DataForwarder[]>(makeDataForwarderQueryKey(params), {
    staleTime: 30000,
    ...options,
  });
}

export function useMutateDataForwarder({
  params,
}: {
  params: {dataForwarderId: string; orgSlug: string};
}) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  return useMutation<DataForwarder, RequestError, DataForwarder>({
    mutationFn: data =>
      api.requestPromise(
        `/organizations/${params.orgSlug}/data-forwarders/${params.dataForwarderId}/`,
        {method: 'PUT', data}
      ),
    onSuccess: (dataForwarder: DataForwarder) => {
      addSuccessMessage(
        tct('[provider] data forwarder updated', {provider: dataForwarder.provider})
      );
      queryClient.invalidateQueries({queryKey: makeDataForwarderQueryKey(params)});
    },
    onError: _error => {
      addErrorMessage(t('Failed to update data forwarder'));
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
        `/organizations/${orgSlug}/data-forwarders/${dataForwarderId}/`,
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

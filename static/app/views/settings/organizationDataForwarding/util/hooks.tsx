import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t, tct} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

import {ProviderLabels, type DataForwarder, type DataForwarderPayload} from './types';

const makeDataForwarderApiOptions = (params: {orgSlug: string}) =>
  apiOptions.as<DataForwarder[]>()('/organizations/$organizationIdOrSlug/forwarding/', {
    path: {organizationIdOrSlug: params.orgSlug},
    staleTime: 30000,
  });

export function useDataForwarders({params}: {params: {orgSlug: string}}) {
  return useQuery(makeDataForwarderApiOptions(params));
}

const makeDataForwarderDetailsApiOptions = (params: {
  dataForwarderId: string;
  orgSlug: string;
}) =>
  apiOptions.as<DataForwarder>()(
    '/organizations/$organizationIdOrSlug/forwarding/$dataForwarderId/',
    {
      path: {
        organizationIdOrSlug: params.orgSlug,
        dataForwarderId: params.dataForwarderId,
      },
      staleTime: 0,
    }
  );

const getDataForwarderEndpoint = ({
  orgSlug,
  dataForwarderId,
}: {
  orgSlug: string;
  dataForwarderId?: string;
}) =>
  dataForwarderId
    ? getApiUrl('/organizations/$organizationIdOrSlug/forwarding/$dataForwarderId/', {
        path: {organizationIdOrSlug: orgSlug, dataForwarderId},
      })
    : getApiUrl('/organizations/$organizationIdOrSlug/forwarding/', {
        path: {organizationIdOrSlug: orgSlug},
      });

/**
 * Mutate a DataForwarder. If an ID is provided, it will be updated otherwise a new one will be created.
 */
export function useMutateDataForwarder({
  params: {orgSlug, dataForwarderId},
  onSuccess,
}: {
  params: {orgSlug: string; dataForwarderId?: string};
  onSuccess?: (dataForwarder: DataForwarder) => void;
}) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  const method = dataForwarderId ? 'PUT' : 'POST';
  const listQueryKey = makeDataForwarderApiOptions({orgSlug}).queryKey;
  const endpoint = getDataForwarderEndpoint({dataForwarderId, orgSlug});
  return useMutation<DataForwarder, RequestError, DataForwarderPayload>({
    mutationFn: data => api.requestPromise(endpoint, {method, data}),
    onSuccess: (dataForwarder: DataForwarder) => {
      toast.success(
        tct('[provider] data forwarder [action]', {
          provider: ProviderLabels[dataForwarder.provider],
          action: dataForwarderId ? t('updated') : t('created'),
        })
      );
      if (dataForwarderId) {
        queryClient.invalidateQueries({
          queryKey: makeDataForwarderDetailsApiOptions({dataForwarderId, orgSlug})
            .queryKey,
        });
      }
      queryClient.invalidateQueries({queryKey: listQueryKey});
      onSuccess?.(dataForwarder);
    },
    onError: error => {
      const displayError =
        JSON.stringify(error.responseJSON) ?? t('Failed to update data forwarder');
      toast.error(displayError);
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
    mutationFn: ({dataForwarderId: dfId, orgSlug: os}) =>
      api.requestPromise(getDataForwarderEndpoint({dataForwarderId: dfId, orgSlug: os}), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      toast.success(t('Data forwarder deleted'));
      queryClient.invalidateQueries({
        queryKey: makeDataForwarderApiOptions(params).queryKey,
      });
    },
    onError: _error => {
      toast.error(t('Failed to delete data forwarder'));
    },
  });
}

export function useMutateDataForwarderProject({
  params: {orgSlug, dataForwarderId, project},
  onSuccess,
}: {
  params: {dataForwarderId: string; orgSlug: string; project: AvatarProject};
  onSuccess?: () => void;
}) {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();
  const listQueryKey = makeDataForwarderApiOptions({orgSlug}).queryKey;
  const endpoint = getDataForwarderEndpoint({dataForwarderId, orgSlug});
  return useMutation<
    void,
    RequestError,
    {is_enabled: boolean; overrides: Record<string, any>; project_id: string}
  >({
    mutationFn: data => api.requestPromise(endpoint, {method: 'PUT', data}),
    onSuccess: () => {
      toast.success(
        tct('Updated project override for [project]', {
          project: project.slug,
        })
      );
      queryClient.invalidateQueries({
        queryKey: makeDataForwarderDetailsApiOptions({dataForwarderId, orgSlug}).queryKey,
      });
      queryClient.invalidateQueries({queryKey: listQueryKey});
      onSuccess?.();
    },
    onError: error => {
      const displayError =
        JSON.stringify(error.responseJSON) ?? t('Failed to update override');
      toast.error(displayError);
    },
  });
}

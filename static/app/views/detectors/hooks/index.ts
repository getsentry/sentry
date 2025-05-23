import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  useApiQueries,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UseDetectorsQueryOptions {
  query?: string;
  sortBy?: string;
}
export function useDetectorsQuery(_options: UseDetectorsQueryOptions = {}) {
  const org = useOrganization();
  return useApiQuery<Detector[]>(makeDetectorQueryKey(org.slug), {
    staleTime: 0,
    retry: false,
  });
}

const makeDetectorQueryKey = (orgSlug: string, detectorId = ''): ApiQueryKey => [
  `/organizations/${orgSlug}/detectors/${detectorId ? `${detectorId}/` : ''}`,
  {query: {query: 'type:metric_issue'}}, // TODO: remove this when backend is ready
];

export function useCreateDetector() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const queryKey = makeDetectorQueryKey(org.slug);

  return useMutation<Detector, void, Detector>({
    mutationFn: data =>
      api.requestPromise(queryKey[0], {
        method: 'POST',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey});
    },
    onError: _ => {
      AlertStore.addAlert({type: 'error', message: t('Unable to create monitor')});
    },
  });
}

export function useDetectorQuery(detectorId: string) {
  const org = useOrganization();

  return useApiQuery<Detector>(makeDetectorQueryKey(org.slug, detectorId), {
    staleTime: 0,
    retry: false,
  });
}

export function useDetectorQueriesByIds(detectorId: string[]) {
  const org = useOrganization();

  return useApiQueries<Detector>(
    detectorId.map(id => makeDetectorQueryKey(org.slug, id)),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {
  useApiQueries,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DetectorUpdatePayload} from 'sentry/views/detectors/components/forms/config';

interface UseDetectorsQueryKeyOptions {
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}

export const makeDetectorListQueryKey = ({
  orgSlug,
  query,
  sortBy,
  projects,
  limit,
  cursor,
  ids,
}: {
  orgSlug: string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/detectors/`,
  {query: {query, sortBy, project: projects, per_page: limit, cursor, id: ids}},
];

export function useDetectorsQuery(
  {ids, query, sortBy, projects, limit, cursor}: UseDetectorsQueryKeyOptions = {},
  queryOptions: Partial<UseApiQueryOptions<Detector[]>> = {}
) {
  const org = useOrganization();

  return useApiQuery<Detector[]>(
    makeDetectorListQueryKey({
      orgSlug: org.slug,
      query,
      sortBy,
      projects,
      limit,
      cursor,
      ids,
    }),
    {
      staleTime: 0,
      retry: false,
      ...queryOptions,
    }
  );
}

export function useCreateDetector() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Detector, void, DetectorUpdatePayload>({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/detectors/`, {
        method: 'POST',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/detectors/`],
      });
    },
    onError: _ => {
      AlertStore.addAlert({type: 'error', message: t('Unable to create monitor')});
    },
  });
}

export function useUpdateDetector() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Detector, void, {detectorId: string} & DetectorUpdatePayload>({
    mutationFn: data =>
      api.requestPromise(`/organizations/${org.slug}/detectors/${data.detectorId}/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/detectors/`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/detectors/${data.detectorId}/`],
      });
    },
    onError: _ => {
      AlertStore.addAlert({type: 'error', message: t('Unable to update monitor')});
    },
  });
}

const makeDetectorDetailsQueryKey = ({
  orgSlug,
  detectorId,
}: {
  detectorId: string;
  orgSlug: string;
}): ApiQueryKey => [`/organizations/${orgSlug}/detectors/${detectorId}/`];

export function useDetectorQuery(detectorId: string) {
  const org = useOrganization();

  return useApiQuery<Detector>(
    makeDetectorDetailsQueryKey({orgSlug: org.slug, detectorId}),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useDetectorQueriesByIds(detectorId: string[]) {
  const org = useOrganization();

  return useApiQueries<Detector>(
    detectorId.map(id =>
      makeDetectorDetailsQueryKey({orgSlug: org.slug, detectorId: id})
    ),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

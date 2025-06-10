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
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';

interface UseDetectorsQueryKeyOptions {
  cursor?: string;
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}

const makeDetectorListQueryKey = ({
  orgSlug,
  query,
  sortBy,
  projects,
  limit,
  cursor,
}: {
  orgSlug: string;
  cursor?: string;
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/detectors/`,
  {query: {query, sortBy, project: projects, per_page: limit, cursor}},
];

export function useDetectorsQuery({
  query,
  sortBy,
  projects,
  limit = DETECTOR_LIST_PAGE_LIMIT,
  cursor,
}: UseDetectorsQueryKeyOptions = {}) {
  const org = useOrganization();

  return useApiQuery<Detector[]>(
    makeDetectorListQueryKey({orgSlug: org.slug, query, sortBy, projects, limit, cursor}),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useCreateDetector() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<Detector, void, Detector>({
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

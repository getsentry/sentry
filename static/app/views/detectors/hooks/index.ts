import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import {
  type BaseDetectorUpdatePayload,
  type Detector,
} from 'sentry/types/workflowEngine/detectors';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface UseDetectorsQueryKeyOptions {
  cursor?: string;
  ids?: string[];
  /**
   * By default, issue stream detectors are excluded from the query,
   * because they are opaque to the user in the UI and only used to
   * make connections to alerts.
   */
  includeIssueStreamDetectors?: boolean;
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}

const createDetectorQuery = (
  query: string | undefined,
  options: {includeIssueStreamDetectors: boolean}
) => {
  if (options.includeIssueStreamDetectors) {
    return query;
  }

  return `!type:issue_stream ${query ?? ''}`.trim();
};

export const makeDetectorListQueryKey = ({
  orgSlug,
  query,
  sortBy,
  projects,
  limit,
  cursor,
  ids,
  includeIssueStreamDetectors = false,
}: {
  orgSlug: string;
  cursor?: string;
  ids?: string[];
  includeIssueStreamDetectors?: boolean;
  limit?: number;
  projects?: number[];
  query?: string;
  sortBy?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/detectors/`,
  {
    query: {
      query: createDetectorQuery(query, {includeIssueStreamDetectors}),
      sortBy,
      project: projects,
      per_page: limit,
      cursor,
      id: ids,
    },
  },
];

export function useDetectorsQuery<T extends Detector = Detector>(
  {
    ids,
    query,
    sortBy,
    projects,
    limit,
    cursor,
    includeIssueStreamDetectors,
  }: UseDetectorsQueryKeyOptions = {},
  queryOptions: Partial<UseApiQueryOptions<T[]>> = {}
) {
  const org = useOrganization();

  return useApiQuery<T[]>(
    makeDetectorListQueryKey({
      orgSlug: org.slug,
      query,
      sortBy,
      projects,
      limit,
      cursor,
      ids,
      includeIssueStreamDetectors,
    }),
    {
      staleTime: 0,
      retry: false,
      ...queryOptions,
    }
  );
}

export function useCreateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, BaseDetectorUpdatePayload>({
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
      AlertStore.addAlert({type: 'danger', message: t('Unable to create monitor')});
    },
  });
}

export function useUpdateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, {detectorId: string} & Partial<BaseDetectorUpdatePayload>>({
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
      AlertStore.addAlert({type: 'danger', message: t('Unable to update monitor')});
    },
  });
}

export const makeDetectorDetailsQueryKey = ({
  orgSlug,
  detectorId,
}: {
  detectorId: string;
  orgSlug: string;
}): ApiQueryKey => [`/organizations/${orgSlug}/detectors/${detectorId}/`];

export function useDetectorQuery<T extends Detector = Detector>(
  detectorId: string,
  queryOptions: Partial<UseApiQueryOptions<T>> = {}
) {
  const org = useOrganization();

  return useApiQuery<T>(makeDetectorDetailsQueryKey({orgSlug: org.slug, detectorId}), {
    staleTime: 0,
    retry: false,
    ...queryOptions,
  });
}

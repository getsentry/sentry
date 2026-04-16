import {queryOptions} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {
  type BaseDetectorUpdatePayload,
  type Detector,
  type UptimeDetector,
} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

interface DetectorTypeMap {
  uptime: UptimeDetector;
}

type DetectorByType<T extends keyof DetectorTypeMap | undefined> =
  T extends keyof DetectorTypeMap ? DetectorTypeMap[T] : Detector;

interface UseDetectorsApiOptionsParams<
  TType extends keyof DetectorTypeMap | undefined = undefined,
> {
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
  /**
   * When set, the query automatically includes `type:{value}` and
   * the return type narrows to the matching detector subtype.
   */
  type?: TType;
}

const createDetectorQuery = (
  query: string | undefined,
  options: {includeIssueStreamDetectors: boolean; type?: string}
) => {
  const parts: string[] = [];
  if (!options.includeIssueStreamDetectors) {
    parts.push('!type:issue_stream');
  }
  if (options.type) {
    parts.push(`type:${options.type}`);
  }
  if (query) {
    parts.push(query);
  }
  return parts.join(' ') || undefined;
};

export function detectorListApiOptions<
  TType extends keyof DetectorTypeMap | undefined = undefined,
>(
  organization: Organization,
  {
    query,
    sortBy,
    projects,
    limit,
    cursor,
    ids,
    type,
    includeIssueStreamDetectors = false,
  }: UseDetectorsApiOptionsParams<TType> = {} as UseDetectorsApiOptionsParams<TType>
) {
  return queryOptions({
    ...apiOptions.as<Array<DetectorByType<TType>>>()(
      '/organizations/$organizationIdOrSlug/detectors/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: createDetectorQuery(query, {includeIssueStreamDetectors, type}),
          sortBy,
          project: projects,
          per_page: limit,
          cursor,
          id: ids,
        },
        staleTime: 0,
      }
    ),
    retry: false,
  });
}

/**
 * Returns a query key prefix that matches all detector list queries
 * regardless of filters. Use with `invalidateQueries` after mutations.
 */
export function allDetectorListsQueryKey(organization: Organization) {
  return detectorListApiOptions(organization, {
    includeIssueStreamDetectors: true,
  }).queryKey;
}

export function useCreateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, BaseDetectorUpdatePayload>({
    mutationFn: data =>
      api.requestPromise(
        getApiUrl(
          '/organizations/$organizationIdOrSlug/projects/$projectIdOrSlug/detectors/',
          {
            path: {organizationIdOrSlug: org.slug, projectIdOrSlug: data.projectId},
          }
        ),
        {
          method: 'POST',
          data,
        }
      ),
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
    },
    onError: _ => {
      AlertStore.addAlert({variant: 'danger', message: t('Unable to create monitor')});
    },
  });
}

export function useUpdateDetector<T extends Detector = Detector>() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<T, void, {detectorId: string} & Partial<BaseDetectorUpdatePayload>>({
    mutationFn: data =>
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
          path: {organizationIdOrSlug: org.slug, detectorId: data.detectorId},
        }),
        {
          method: 'PUT',
          data,
        }
      ),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
            path: {organizationIdOrSlug: org.slug, detectorId: data.detectorId},
          }),
        ],
      });
    },
    onError: _ => {
      AlertStore.addAlert({variant: 'danger', message: t('Unable to update monitor')});
    },
  });
}

export const makeDetectorDetailsQueryKey = ({
  orgSlug,
  detectorId,
}: {
  detectorId: string;
  orgSlug: string;
}): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
    path: {organizationIdOrSlug: orgSlug, detectorId},
  }),
];

export function useDetectorQuery<T extends Detector = Detector>(
  detectorId: string,
  options: Partial<UseApiQueryOptions<T>> = {}
) {
  const org = useOrganization();

  return useApiQuery<T>(makeDetectorDetailsQueryKey({orgSlug: org.slug, detectorId}), {
    staleTime: 0,
    retry: false,
    ...options,
  });
}

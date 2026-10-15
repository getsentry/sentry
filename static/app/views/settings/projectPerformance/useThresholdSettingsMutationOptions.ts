import {useQueryClient} from '@tanstack/react-query';

import {trackAnalytics} from 'sentry/utils/analytics';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import type {ProjectThreshold, ThresholdMetric} from './projectPerformanceSettings';

type TransactionThresholdUpdate =
  | {metric: ThresholdMetric}
  | {threshold: ProjectThreshold['threshold']};

export const getThresholdQueryOptions = (orgSlug: string, projectSlug: string) =>
  apiOptions.as<ProjectThreshold>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export const getThresholdSettingsMutationKey = (orgSlug: string, projectSlug: string) =>
  ['project-performance-threshold-settings', orgSlug, projectSlug] as const;

function updateThresholdSettings(
  orgSlug: string,
  projectSlug: string,
  data: TransactionThresholdUpdate
) {
  return apiFetch<ProjectThreshold>({
    queryKey: [
      getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
        {path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug}}
      ),
      {method: 'POST', data},
    ],
  });
}

export function useThresholdSettingsMutationOptions(threshold: ProjectThreshold) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const mutationKeyPrefix = getThresholdSettingsMutationKey(
    organization.slug,
    projectSlug
  );
  const mutationScope = {id: mutationKeyPrefix.join(':')};

  const cacheThreshold = (data: ProjectThreshold) => {
    queryClient.setQueryData(
      getThresholdQueryOptions(organization.slug, projectSlug).queryKey,
      previous => ({json: data, headers: previous?.headers ?? {}})
    );
  };

  return {
    metricMutationOptions: {
      mutationKey: [...mutationKeyPrefix, 'metric'],
      scope: mutationScope,
      mutationFn: (data: {metric: ThresholdMetric}) =>
        updateThresholdSettings(organization.slug, projectSlug, data),
      onSuccess: ({json: updated}: ApiResponse<ProjectThreshold>) => {
        trackAnalytics('performance_views.project_transaction_threshold.change', {
          organization,
          from: threshold.metric,
          to: updated.metric,
          key: 'metric',
        });
        cacheThreshold(updated);
      },
    },
    thresholdMutationOptions: {
      mutationKey: [...mutationKeyPrefix, 'threshold'],
      scope: mutationScope,
      mutationFn: (data: {threshold: string}) =>
        updateThresholdSettings(organization.slug, projectSlug, data),
      onSuccess: ({json: updated}: ApiResponse<ProjectThreshold>) => {
        trackAnalytics('performance_views.project_transaction_threshold.change', {
          organization,
          from: threshold.threshold,
          to: updated.threshold,
          key: 'threshold',
        });
        cacheThreshold(updated);
      },
    },
  };
}

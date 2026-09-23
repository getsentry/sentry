import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ProjectPerformanceSettings} from './detectorSettings';

export const getPerformanceIssueSettingsQueryOptions = (
  orgSlug: string,
  projectSlug: string
) =>
  apiOptions.as<ProjectPerformanceSettings>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: 0,
    }
  );

export const getDetectorSettingsMutationKey = (orgSlug: string, projectSlug: string) =>
  ['project-performance-detector-settings', orgSlug, projectSlug] as const;

type DetectorFieldMutationOptions = {
  projectSlug: string;
  onError?: (error: Error) => void;
};

export function useDetectorFieldMutationOptions({
  projectSlug,
  onError,
}: DetectorFieldMutationOptions) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const mutationKey = getDetectorSettingsMutationKey(organization.slug, projectSlug);
  const queryOptions = getPerformanceIssueSettingsQueryOptions(
    organization.slug,
    projectSlug
  );

  return mutationOptions({
    mutationKey,
    scope: {id: mutationKey.join(':')},
    mutationFn: (data: ProjectPerformanceSettings) =>
      fetchMutation<ProjectPerformanceSettings>({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/performance-issues/configure/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug}}
        ),
        method: 'PUT',
        data,
      }),
    onMutate: async (variables: ProjectPerformanceSettings) => {
      await queryClient.cancelQueries({queryKey: queryOptions.queryKey});

      const previousData = queryClient.getQueryData(queryOptions.queryKey);

      queryClient.setQueryData(queryOptions.queryKey, previous =>
        previous
          ? {json: {...previous.json, ...variables}, headers: previous.headers}
          : previous
      );

      return {previousData};
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryOptions.queryKey, previous =>
        previous
          ? {json: {...previous.json, ...data}, headers: previous.headers}
          : previous
      );

      const [thresholdKey, thresholdValue] = Object.entries(variables)[0] ?? [];
      if (thresholdKey && typeof thresholdValue === 'number') {
        trackAnalytics('performance_views.project_issue_detection_threshold_changed', {
          organization,
          project_slug: projectSlug,
          threshold_key: thresholdKey,
          threshold_value: thresholdValue,
        });
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryOptions.queryKey, context.previousData);
      }

      onError?.(error);
    },
  });
}

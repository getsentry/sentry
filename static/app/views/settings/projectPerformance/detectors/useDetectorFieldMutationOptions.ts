import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

export function useDetectorFieldMutationOptions(projectSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryOptions = getPerformanceIssueSettingsQueryOptions(
    organization.slug,
    projectSlug
  );

  return mutationOptions({
    mutationFn: (data: ProjectPerformanceSettings) =>
      fetchMutation<ProjectPerformanceSettings>({
        url: `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`,
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
    onSuccess: (_data, variables) => {
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
    onSettled: (_data, error, _variables, context) => {
      if (error && context?.previousData) {
        queryClient.setQueryData(queryOptions.queryKey, context.previousData);
      }
    },
  });
}

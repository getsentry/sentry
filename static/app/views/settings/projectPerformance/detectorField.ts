import {useQueryClient} from '@tanstack/react-query';

import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getPerformanceIssueSettingsQueryOptions,
  type DetectorConfigAdmin,
  type DetectorConfigCustomer,
  type ProjectPerformanceSettings,
} from './detectorSettings';

type DetectorFieldName = DetectorConfigAdmin | DetectorConfigCustomer;

export type CommonDetectorFieldProps = {
  disabled: boolean | string;
  endpoint: string;
  initialValue: boolean | number | string;
  label: string;
  name: DetectorFieldName;
  projectSlug: string;
  help?: string;
};

export function useDetectorFieldMutationOptions(endpoint: string, projectSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return {
    mutationFn: (data: ProjectPerformanceSettings) =>
      fetchMutation<ProjectPerformanceSettings>({url: endpoint, method: 'PUT', data}),
    onSuccess: (
      _data: ProjectPerformanceSettings,
      variables: ProjectPerformanceSettings
    ) => {
      queryClient.setQueryData(
        getPerformanceIssueSettingsQueryOptions(organization.slug, projectSlug).queryKey,
        previous =>
          previous
            ? {json: {...previous.json, ...variables}, headers: previous.headers}
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
  };
}

import {useState} from 'react';
import {useIsMutating, useMutation, useQueryClient} from '@tanstack/react-query';

import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {
  getDetectorSettingsMutationKey,
  getPerformanceIssueSettingsQueryOptions,
} from './detectors/useDetectorFieldMutationOptions';
import {
  getThresholdQueryOptions,
  getThresholdSettingsMutationKey,
} from './useThresholdSettingsMutationOptions';

type ProjectPerformanceReset = {
  detectorResetVersion: number;
  isResettingDetectorSettings: boolean;
  isResettingThresholdSettings: boolean;
  isSavingDetectorSettings: boolean;
  isSavingThresholdSettings: boolean;
  resetDetectorSettings: () => void;
  resetThresholdSettings: () => void;
  thresholdResetVersion: number;
};

export function useProjectPerformanceReset(): ProjectPerformanceReset {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const [detectorResetVersion, setDetectorResetVersion] = useState(0);
  const [thresholdResetVersion, setThresholdResetVersion] = useState(0);

  const thresholdQueryOptions = getThresholdQueryOptions(organization.slug, projectSlug);
  const performanceIssueSettingsQueryOptions = getPerformanceIssueSettingsQueryOptions(
    organization.slug,
    projectSlug
  );
  const isSavingThresholdSettings =
    useIsMutating({
      mutationKey: getThresholdSettingsMutationKey(organization.slug, projectSlug),
    }) > 0;
  const isSavingDetectorSettings =
    useIsMutating({
      mutationKey: getDetectorSettingsMutationKey(organization.slug, projectSlug),
      exact: true,
    }) > 0;

  const thresholdSettingsReset = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`,
        method: 'DELETE',
      }),
    onMutate: () => {
      trackAnalytics('performance_views.project_transaction_threshold.clear', {
        organization,
      });
    },
    onSuccess: async () => {
      await queryClient.fetchQuery(thresholdQueryOptions);
      setThresholdResetVersion(version => version + 1);
    },
  });

  const detectorSettingsReset = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`,
        method: 'DELETE',
      }),
    onMutate: () => {
      trackAnalytics('performance_views.project_issue_detection_thresholds_reset', {
        organization,
        project_slug: projectSlug,
      });
    },
    onSuccess: async () => {
      await queryClient.fetchQuery(performanceIssueSettingsQueryOptions);
      setDetectorResetVersion(version => version + 1);
    },
  });

  return {
    detectorResetVersion,
    isResettingDetectorSettings: detectorSettingsReset.isPending,
    isResettingThresholdSettings: thresholdSettingsReset.isPending,
    isSavingDetectorSettings,
    isSavingThresholdSettings,
    resetDetectorSettings: () => {
      if (!isSavingDetectorSettings) {
        detectorSettingsReset.mutate();
      }
    },
    resetThresholdSettings: () => {
      if (!isSavingThresholdSettings) {
        thresholdSettingsReset.mutate();
      }
    },
    thresholdResetVersion,
  };
}

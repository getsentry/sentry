import {Fragment, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {
  getGeneralSettingsQueryOptions,
  getPerformanceIssueSettingsQueryOptions,
  getProjectDetectorSettings,
  getThresholdQueryOptions,
} from './detectorSettings';
import {
  AdminRegressionSettingsSection,
  DetectorThresholdsSection,
} from './detectorThresholdsSection';
import {GeneralSettingsSection} from './generalSettingsSection';
import {SamplingPrioritiesSection} from './samplingPrioritiesSection';
import {ThresholdSettingsSection} from './thresholdSettingsSection';

export {
  allowedCountValues,
  allowedDurationValues,
  allowedPercentageValues,
  allowedSizeValues,
  DetectorConfigCustomer,
  projectDetectorSettingsId,
  retentionPrioritiesLabels,
} from './detectorSettings';

export function ProjectPerformance() {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const [thresholdResetVersion, setThresholdResetVersion] = useState(0);
  const [detectorResetVersion, setDetectorResetVersion] = useState(0);

  const thresholdEndpoint = `/projects/${organization.slug}/${projectSlug}/transaction-threshold/configure/`;
  const performanceIssuesEndpoint = `/projects/${organization.slug}/${projectSlug}/performance-issues/configure/`;
  const thresholdQueryOptions = getThresholdQueryOptions(organization.slug, projectSlug);
  const performanceIssueSettingsQueryOptions = getPerformanceIssueSettingsQueryOptions(
    organization.slug,
    projectSlug
  );
  const generalSettingsQueryOptions = getGeneralSettingsQueryOptions(
    organization.slug,
    projectSlug
  );

  const {
    data: project,
    isPending: isPendingProject,
    isError: isErrorProject,
  } = useDetailedProject({projectSlug, orgSlug: organization.slug});

  const hasWebVitalsSeerSuggestions = useHasSeerWebVitalsSuggestions(project);
  const hasAIIssueDetection =
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('ai-issue-detection') &&
    !organization.hideAiFeatures;

  const {
    data: threshold,
    isPending: isPendingThreshold,
    isError: isErrorThreshold,
  } = useQuery(thresholdQueryOptions);

  const {
    data: performanceIssueSettings,
    isPending: isPendingPerformanceIssueSettings,
    isError: isErrorPerformanceIssueSettings,
  } = useQuery(performanceIssueSettingsQueryOptions);

  const {
    data: general,
    isPending: isPendingGeneral,
    isError: isErrorGeneral,
  } = useQuery(generalSettingsQueryOptions);

  const {mutate: resetThresholdSettings, isPending: isPendingResetThresholdSettings} =
    useMutation({
      mutationFn: () => fetchMutation({url: thresholdEndpoint, method: 'DELETE'}),
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

  const {mutate: resetThresholds, isPending: isPendingResetThresholds} = useMutation({
    mutationFn: () => fetchMutation({url: performanceIssuesEndpoint, method: 'DELETE'}),
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

  if (
    isPendingThreshold ||
    isPendingPerformanceIssueSettings ||
    isPendingGeneral ||
    isPendingProject
  ) {
    return (
      <Container padding="lg">
        <LoadingIndicator />
      </Container>
    );
  }

  if (
    isErrorThreshold ||
    isErrorPerformanceIssueSettings ||
    isErrorGeneral ||
    isErrorProject
  ) {
    return <LoadingError />;
  }

  const requiredScopes: Scope[] = ['project:write'];
  const hasWriteAccess = hasEveryAccess(requiredScopes, {organization, project});
  const detectorGroups = getProjectDetectorSettings({
    endpoint: performanceIssuesEndpoint,
    hasAccess: hasWriteAccess,
    hasAIIssueDetection,
    hasWebVitalsSeerSuggestions,
    organization,
    performanceIssueSettings,
    projectSlug,
    resetVersion: detectorResetVersion,
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Performance')} projectSlug={projectSlug} />
      <SettingsPageHeader title={t('Performance')} />
      <ProjectPermissionAlert project={project} />
      <GeneralSettingsSection general={general} hasWriteAccess={hasWriteAccess} />
      <ThresholdSettingsSection
        threshold={threshold}
        hasWriteAccess={hasWriteAccess}
        isResetting={isPendingResetThresholdSettings}
        onResetAll={() => resetThresholdSettings()}
        resetVersion={thresholdResetVersion}
      />
      <SamplingPrioritiesSection project={project} hasWriteAccess={hasWriteAccess} />
      {isActiveSuperuser() && (
        <AdminRegressionSettingsSection
          performanceIssueSettings={performanceIssueSettings}
        />
      )}
      <DetectorThresholdsSection
        detectorGroups={detectorGroups}
        performanceIssueSettings={performanceIssueSettings}
        hasWriteAccess={hasWriteAccess}
        isResetting={isPendingResetThresholds}
        onResetAll={() => resetThresholds()}
      />
    </Fragment>
  );
}

export default function ProjectPerformanceContainer() {
  return (
    <Feature features="performance-view">
      <ProjectPerformance />
    </Feature>
  );
}

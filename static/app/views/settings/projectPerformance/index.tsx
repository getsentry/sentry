import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {getProjectDetectorSettings} from './detectors/detectorFieldGroups';
import {
  AdminRegressionSettingsSection,
  DetectorThresholdsSection,
} from './detectors/detectorThresholdsSection';
import {getPerformanceIssueSettingsQueryOptions} from './detectors/useDetectorFieldMutationOptions';
import {SamplingPrioritiesSection} from './samplingPriorities/samplingPrioritiesSection';
import {GeneralSettingsSection} from './generalSettingsSection';
import {ThresholdSettingsSection} from './thresholdSettingsSection';
import {getGeneralSettingsQueryOptions} from './useGeneralSettingsMutationOptions';
import {useProjectPerformanceReset} from './useProjectPerformanceReset';
import {getThresholdQueryOptions} from './useThresholdSettingsMutationOptions';

export {retentionPrioritiesLabels} from './samplingPriorities/retentionPrioritySettings';

export function ProjectPerformance() {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const {
    detectorResetVersion,
    isResettingDetectorSettings,
    isResettingThresholdSettings,
    isSavingDetectorSettings,
    isSavingThresholdSettings,
    resetDetectorSettings,
    resetThresholdSettings,
    thresholdResetVersion,
  } = useProjectPerformanceReset();

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
    organization.features.includes('ai-issue-detection') &&
    areAiFeaturesAllowed(organization);

  // Apdex and User Misery thresholds only apply to the transactions dataset.
  const hasThresholdSettings = !useInsightsEap();
  const {
    data: threshold,
    isLoading: isLoadingThreshold,
    isError: isErrorThreshold,
  } = useQuery({...thresholdQueryOptions, enabled: hasThresholdSettings});

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

  if (
    isLoadingThreshold ||
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
    hasAccess: hasWriteAccess,
    hasAIIssueDetection,
    hasWebVitalsSeerSuggestions,
    isResetting: isResettingDetectorSettings,
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
      {hasThresholdSettings && threshold ? (
        <ThresholdSettingsSection
          key={thresholdResetVersion}
          threshold={threshold}
          hasWriteAccess={hasWriteAccess}
          isResetting={isResettingThresholdSettings}
          isSaving={isSavingThresholdSettings}
          onResetAll={resetThresholdSettings}
        />
      ) : null}
      <SamplingPrioritiesSection project={project} hasWriteAccess={hasWriteAccess} />
      {isActiveSuperuser() && (
        <AdminRegressionSettingsSection
          hasWriteAccess={hasWriteAccess}
          isResetting={isResettingDetectorSettings}
          performanceIssueSettings={performanceIssueSettings}
        />
      )}
      <DetectorThresholdsSection
        detectorGroups={detectorGroups}
        performanceIssueSettings={performanceIssueSettings}
        hasWriteAccess={hasWriteAccess}
        isResetting={isResettingDetectorSettings}
        isSaving={isSavingDetectorSettings}
        onResetAll={resetDetectorSettings}
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

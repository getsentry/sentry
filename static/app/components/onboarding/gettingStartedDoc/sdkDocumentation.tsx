import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import type {
  ConfigType,
  ProductSolution,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project} from 'sentry/types/project';

type SdkDocumentationProps = {
  activeProductSelection: ProductSolution[];
  organization: Organization;
  platform: PlatformIntegration;
  projectId: Project['id'];
  projectSlug: Project['slug'];
  configType?: ConfigType;
  newOrg?: boolean;
};

// Loads the component containing the documentation for the specified platform
export function SdkDocumentation({
  platform,
  projectSlug,
  activeProductSelection,
  newOrg,
  projectId,
  configType,
  organization,
}: SdkDocumentationProps) {
  const {isLoading, isError, dsn, docs, refetch, projectKeyId} = useLoadGettingStarted({
    orgSlug: organization.slug,
    projSlug: projectSlug,
    platform,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading the getting started documentation for this platform.'
        )}
      />
    );
  }

  if (!docs) {
    return (
      <LoadingError
        message={t(
          'The getting started documentation for this platform is currently unavailable.'
        )}
      />
    );
  }

  if (!dsn) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading the DSN for this getting started documentation.'
        )}
        onRetry={refetch}
      />
    );
  }

  if (!projectKeyId) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading Client Keys for this getting started documentation.'
        )}
        onRetry={refetch}
      />
    );
  }

  return (
    <OnboardingLayout
      docsConfig={docs}
      dsn={dsn}
      activeProductSelection={activeProductSelection}
      newOrg={newOrg}
      platformKey={platform.id}
      projectId={projectId}
      projectSlug={projectSlug}
      configType={configType}
      projectKeyId={projectKeyId}
    />
  );
}

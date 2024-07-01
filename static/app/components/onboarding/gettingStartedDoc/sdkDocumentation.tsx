import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import type {ConfigType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import useLoadGettingStarted from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import type {ProductSolution} from 'sentry/components/onboarding/productSelection';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project, ProjectKey} from 'sentry/types/project';
import {getPlatformPath} from 'sentry/utils/gettingStartedDocs/getPlatformPath';
import {useApiQuery} from 'sentry/utils/queryClient';

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
  organization,
  projectId,
  configType,
}: SdkDocumentationProps) {
  const platformPath = getPlatformPath(platform);

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
    refetch: refetchProjectKeys,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  const module = useLoadGettingStarted({
    platformId: platform.id,
    platformPath,
  });

  if (!module || projectKeysIsLoading) {
    return <LoadingIndicator />;
  }

  if (projectKeysIsError || module === 'none') {
    return <LoadingError onRetry={refetchProjectKeys} />;
  }
  const {default: docs} = module;

  return (
    <OnboardingLayout
      docsConfig={docs}
      dsn={projectKeys[0].dsn.public}
      cdn={projectKeys[0].dsn.cdn}
      activeProductSelection={activeProductSelection}
      newOrg={newOrg}
      platformKey={platform.id}
      projectId={projectId}
      projectSlug={projectSlug}
      configType={configType}
    />
  );
}

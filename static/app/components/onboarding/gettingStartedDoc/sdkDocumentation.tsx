import {useEffect, useState} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingLayout} from 'sentry/components/onboarding/gettingStartedDoc/onboardingLayout';
import {ConfigType, Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import type {
  Organization,
  PlatformIntegration,
  PlatformKey,
  Project,
  ProjectKey,
} from 'sentry/types';
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

export type ModuleProps = {
  dsn: string;
  projectSlug: Project['slug'];
  activeProductSelection?: ProductSolution[];
  newOrg?: boolean;
  organization?: Organization;
  platformKey?: PlatformKey;
  projectId?: Project['id'];
  sourcePackageRegistries?: ReturnType<typeof useSourcePackageRegistries>;
};

function isFunctionalComponent(obj: any): obj is React.ComponentType<ModuleProps> {
  // As we only use function components in the docs this should suffice
  return typeof obj === 'function';
}

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
  const sourcePackageRegistries = useSourcePackageRegistries(organization);

  const [module, setModule] = useState<null | {
    default: Docs<any> | React.ComponentType<ModuleProps>;
  }>(null);

  // TODO: This will be removed once we no longer rely on sentry-docs to load platform icons
  const platformPath =
    platform?.type === 'framework'
      ? platform.language === 'minidump'
        ? `minidump/minidump`
        : platform?.id === 'native-qt'
        ? `native/native-qt`
        : platform?.id === 'android'
        ? `android/android`
        : platform?.id === 'ionic'
        ? `ionic/ionic`
        : platform?.id === 'unity'
        ? `unity/unity`
        : platform?.id === 'unreal'
        ? `unreal/unreal`
        : platform?.id === 'capacitor'
        ? `capacitor/capacitor`
        : platform?.id === 'flutter'
        ? `flutter/flutter`
        : platform?.id === 'dart'
        ? `dart/dart`
        : platform?.id.replace(`${platform.language}-`, `${platform.language}/`)
      : platform?.id === 'python-celery'
      ? `python/celery`
      : platform?.id === 'python-rq'
      ? `python/rq`
      : platform?.id === 'python-pymongo'
      ? `python/mongo`
      : `${platform?.language}/${platform?.id}`;

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
    refetch: refetchProjectKeys,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  useEffect(() => {
    async function getGettingStartedDoc() {
      const mod = await import(
        /* webpackExclude: /.spec/ */
        `sentry/gettingStartedDocs/${platformPath}`
      );
      setModule(mod);
    }
    getGettingStartedDoc();
    return () => {
      setModule(null);
    };
  }, [platformPath]);

  if (!module || projectKeysIsLoading) {
    return <LoadingIndicator />;
  }

  if (projectKeysIsError) {
    return <LoadingError onRetry={refetchProjectKeys} />;
  }

  const {default: docs} = module;

  if (isFunctionalComponent(docs)) {
    const GettingStartedDoc = docs;
    return (
      <GettingStartedDoc
        dsn={projectKeys[0].dsn.public}
        activeProductSelection={activeProductSelection}
        newOrg={newOrg}
        platformKey={platform.id}
        organization={organization}
        projectId={projectId}
        projectSlug={projectSlug}
        sourcePackageRegistries={sourcePackageRegistries}
      />
    );
  }

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

import {useEffect, useState} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import type {Organization, PlatformIntegration, Project, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

type SdkDocumentationProps = {
  activeProductSelection: ProductSolution[];
  organization: Organization;
  platform: PlatformIntegration | null;
  projectSlug: Project['slug'];
  newOrg?: boolean;
  projectId?: Project['id'];
};

export type ModuleProps = {
  dsn: string;
  activeProductSelection?: ProductSolution[];
  newOrg?: boolean;
  organization?: Organization;
  platformKey?: PlatformKey;
  projectId?: Project['id'];
  sourcePackageRegistries?: ReturnType<typeof useSourcePackageRegistries>;
};

// Loads the component containing the documentation for the specified platform
export function SdkDocumentation({
  platform,
  projectSlug,
  activeProductSelection,
  newOrg,
  organization,
  projectId,
}: SdkDocumentationProps) {
  const sourcePackageRegistries = useSourcePackageRegistries(organization);

  const [module, setModule] = useState<null | {
    default: React.ComponentType<ModuleProps>;
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
    data: projectKeys = [],
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  useEffect(() => {
    if (projectKeysIsError || projectKeysIsLoading) {
      return;
    }

    async function getGettingStartedDoc() {
      const mod = await import(
        /* webpackExclude: /.spec/ */
        `sentry/gettingStartedDocs/${platformPath}`
      );
      setModule(mod);
    }
    getGettingStartedDoc();
  }, [platformPath, projectKeysIsError, projectKeysIsLoading, projectKeys]);

  if (!module) {
    return <LoadingIndicator />;
  }

  const {default: GettingStartedDoc} = module;

  return (
    <GettingStartedDoc
      dsn={projectKeys[0].dsn.public}
      activeProductSelection={activeProductSelection}
      newOrg={newOrg}
      platformKey={platform?.id}
      organization={organization}
      projectId={projectId}
      sourcePackageRegistries={sourcePackageRegistries}
    />
  );
}

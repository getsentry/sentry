import {useEffect, useState} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization, PlatformIntegration, Project, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

// Documents already migrated from sentry-docs to main sentry repository
export const migratedDocs = [
  'javascript-react',
  'javascript-remix',
  'javascript-angular',
  'javascript-vue',
  'javascript-gatsby',
  'javascript-ember',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-nextjs',
  'javascript',
  'python-django',
  'python',
  'python-flask',
  'python-wsgi',
  'python-tryton',
  'python-tornado',
  'python-starlette',
  'python-serverless',
  'python-sanic',
  'python-quart',
  'python-pyramid',
  'python-pylons',
  'python-gcpfunctions',
  'python-falcon',
  'python-chalice',
  'python-bottle',
  'python-fastapi',
  'python-asgi',
  'python-aiohttp',
  'python-awslambda',
  'react-native',
  'java',
  'java-spring-boot',
  'java-logback',
  'java-log4j2',
  'java-spring',
  'php',
  'php-laravel',
  'php-symfony',
  'go',
  'rust',
  'minidump',
  'native',
  'native-qt',
  'ruby',
  'ruby-rails',
  'ruby-rack',
  'kotlin',
  'node',
  'node-gcpfunctions',
  'node-express',
  'electron',
  'elixir',
];

type SdkDocumentationProps = {
  activeProductSelection: ProductSolution[];
  orgSlug: Organization['slug'];
  platform: PlatformIntegration | null;
  projectSlug: Project['slug'];
  newOrg?: boolean;
};

export type ModuleProps = {
  dsn: string;
  activeProductSelection?: ProductSolution[];
  newOrg?: boolean;
  platformKey?: PlatformKey;
};

// Loads the component containing the documentation for the specified platform
export function SdkDocumentation({
  platform,
  orgSlug,
  projectSlug,
  activeProductSelection,
  newOrg,
}: SdkDocumentationProps) {
  const [module, setModule] = useState<null | {
    default: React.ComponentType<ModuleProps>;
  }>(null);

  const platformPath =
    platform?.type === 'framework'
      ? platform.language === 'minidump'
        ? `minidump/minidump`
        : platform?.id === 'native-qt'
        ? `native/native-qt`
        : platform?.id.replace(`${platform.language}-`, `${platform.language}/`)
      : `${platform?.language}/${platform?.id}`;

  const {
    data: projectKeys = [],
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>([`/projects/${orgSlug}/${projectSlug}/keys/`], {
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
    />
  );
}

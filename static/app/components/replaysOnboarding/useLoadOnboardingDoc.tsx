import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {replayPlatforms} from 'sentry/data/platformCategories';
import type {Organization, PlatformIntegration, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

function useLoadOnboardingDoc({
  platform,
  organization,
  projectSlug,
}: {
  organization: Organization;
  platform: PlatformIntegration;
  projectSlug: string;
}) {
  const [module, setModule] = useState<
    | null
    | {
        default: Docs<any>;
      }
    | 'none'
  >(null);

  const platformPath =
    platform?.type === 'framework'
      ? platform?.id === 'capacitor'
        ? `capacitor/capacitor`
        : platform?.id.replace(`${platform.language}-`, `${platform.language}/`)
      : `${platform?.language}/${platform?.id}`;

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  useEffect(() => {
    async function getGettingStartedDoc() {
      if (!replayPlatforms.includes(platform.id)) {
        setModule('none');
        return;
      }
      try {
        const mod = await import(
          /* webpackExclude: /.spec/ */
          `sentry/gettingStartedDocs/${platformPath}`
        );
        setModule(mod);
      } catch (err) {
        Sentry.captureException(err);
      }
    }
    getGettingStartedDoc();
    return () => {
      setModule(null);
    };
  }, [platformPath, platform.id]);

  if (module === 'none') {
    return {
      docs: null,
    };
  }

  if (!module || projectKeysIsLoading) {
    return {
      isProjKeysLoading: true,
    };
  }

  if (projectKeysIsError) {
    return {
      isProjKeysError: true,
    };
  }

  const {default: docs} = module;

  return {
    docs,
    dsn: projectKeys[0].dsn.public,
    cdn: projectKeys[0].dsn.cdn,
  };
}

export default useLoadOnboardingDoc;

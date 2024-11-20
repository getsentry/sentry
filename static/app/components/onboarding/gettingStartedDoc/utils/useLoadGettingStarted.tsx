import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  featureFlagOnboardingPlatforms,
  feedbackOnboardingPlatforms,
  replayPlatforms,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project, ProjectKey} from 'sentry/types/project';
import {getPlatformPath} from 'sentry/utils/gettingStartedDocs/getPlatformPath';
import {useProjectKeys} from 'sentry/utils/useProjectKeys';

type Props = {
  orgSlug: Organization['slug'];
  platform: PlatformIntegration;
  productType?: 'feedback' | 'replay' | 'performance' | 'featureFlags';
  projSlug?: Project['slug'];
};

export function useLoadGettingStarted({
  platform,
  productType,
  orgSlug,
  projSlug,
}: Props): {
  docs: Docs<any> | null;
  dsn: ProjectKey['dsn'] | undefined;
  isError: boolean;
  isLoading: boolean;
  projectKeyId: Project['id'] | undefined;
  refetch: () => void;
} {
  const [module, setModule] = useState<undefined | 'none' | {default: Docs<any>}>(
    undefined
  );

  const projectKeys = useProjectKeys({orgSlug, projSlug});
  const platformPath = getPlatformPath(platform);

  useEffect(() => {
    async function getGettingStartedDoc() {
      if (
        !platformPath ||
        (productType === 'replay' && !replayPlatforms.includes(platform.id)) ||
        (productType === 'performance' && !withPerformanceOnboarding.has(platform.id)) ||
        (productType === 'feedback' &&
          !feedbackOnboardingPlatforms.includes(platform.id)) ||
        (productType === 'featureFlags' &&
          !featureFlagOnboardingPlatforms.includes(platform.id))
      ) {
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
        setModule(undefined);
        Sentry.captureException(err);
      }
    }

    getGettingStartedDoc();

    return () => {
      setModule(undefined);
    };
  }, [platformPath, platform.id, productType]);

  return {
    refetch: projectKeys.refetch,
    isLoading: projectKeys.isPending || module === undefined,
    isError: projectKeys.isError,
    docs: module === 'none' ? null : module?.default ?? null,
    dsn: projectKeys.data?.[0]?.dsn,
    projectKeyId: projectKeys.data?.[0]?.id,
  };
}

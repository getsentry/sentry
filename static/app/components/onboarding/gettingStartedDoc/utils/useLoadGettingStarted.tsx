import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingPlatforms,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import type {PlatformKey} from 'sentry/types/project';

export default function useLoadGettingStarted({
  platformId,
  platformPath,
  productType,
}: {
  platformId: PlatformKey;
  platformPath: string;
  productType?: 'feedback' | 'replay';
}) {
  const [module, setModule] = useState<
    | null
    | {
        default: Docs<any>;
      }
    | 'none'
  >(null);

  useEffect(() => {
    async function getGettingStartedDoc() {
      if (
        (productType === 'replay' && !replayPlatforms.includes(platformId)) ||
        (productType === 'feedback' && !feedbackOnboardingPlatforms.includes(platformId))
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
        Sentry.captureException(err);
      }
    }
    getGettingStartedDoc();
    return () => {
      setModule(null);
    };
  }, [platformPath, platformId, productType]);

  return module;
}

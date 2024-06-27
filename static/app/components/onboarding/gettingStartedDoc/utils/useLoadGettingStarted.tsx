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
  replayPlatformCheck,
  feedbackPlatformCheck,
}: {
  platformId: PlatformKey;
  platformPath: string;
  feedbackPlatformCheck?: boolean;
  replayPlatformCheck?: boolean;
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
      if (replayPlatformCheck && !replayPlatforms.includes(platformId)) {
        setModule('none');
        return;
      }
      if (feedbackPlatformCheck && !feedbackOnboardingPlatforms.includes(platformId)) {
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
  }, [platformPath, platformId, replayPlatformCheck, feedbackPlatformCheck]);

  return module;
}

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getProfilingSentryPropertiesSnippet,
  profiling as profilingBase,
} from 'sentry/gettingStartedDocs/java/profiling';
import {tct} from 'sentry/locale';

export const profiling: OnboardingConfig = {
  introduction: params => profilingBase.introduction?.(params),
  install: params => profilingBase.install(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, configure the Sentry Spring SDK via [code:sentry.properties]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'properties',
          code: getProfilingSentryPropertiesSnippet(),
        },
      ],
    },
  ],
  verify: (params: DocsParams) => profilingBase.verify(params),
};

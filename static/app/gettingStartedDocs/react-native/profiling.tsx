import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getConfigureSnippet, installCodeBlock} from './utils';

export const profiling: OnboardingConfig = {
  install: () => [
    {
      title: t('Install'),
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 5.32.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        installCodeBlock,
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Enable Tracing and Profiling by adding [code:tracesSampleRate] and [code:profilesSampleRate] to your [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet({
            ...params,
            isProfilingSelected: true,
          }),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getConfigureSnippet, getExcimerInstallSteps} from './utils';

export const profiling: OnboardingConfig = {
  introduction: () => (
    <p>
      {tct(
        'Symfony is supported via the [code:sentry-symfony] package as a native bundle.',
        {code: <code />}
      )}
    </p>
  ),
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [code:sentry/sentry-symfony] bundle:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-symfony',
        },
        ...getExcimerInstallSteps(params),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct('Add your DSN to your [code:.env] file:'),
        },
        {
          type: 'code',
          language: 'shell',
          code: `
###> sentry/sentry-symfony ###
SENTRY_DSN="${params.dsn.public}"
###< sentry/sentry-symfony ###
          `,
        },
        ...getConfigureSnippet(params),
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
  nextSteps: () => [],
};

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "Sentry captures data by using an SDK within your application's runtime."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm registry',
              language: 'javascript',
              code: `import * as Sentry from "npm:@sentry/deno";`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'javascript',
              label: 'JavaScript',
              code: `
Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  // enable performance
  tracesSampleRate: 1.0,`
      : ''
  }
});`,
            },
          ],
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
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `setTimeout(() => {
                throw new Error();
              });`,
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [],
};

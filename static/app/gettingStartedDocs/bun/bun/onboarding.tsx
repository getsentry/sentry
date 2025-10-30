import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
//...
import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isLogsSelected
      ? `
  // Send structured logs to Sentry
  enableLogs: true,`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  // Tracing
  tracesSampleRate: 1.0, // Capture 100% of the transactions`
      : ''
  }
});`;

const getVerifySnippet = () => `try {
  throw new Error('Sentry Bun test');
} catch (e) {
  Sentry.captureException(e);
}`;

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
          language: 'bash',
          code: 'bun add @sentry/bun',
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
          language: 'javascript',
          code: getConfigureSnippet(params),
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
          language: 'javascript',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/bun/logs/#integrations',
      });
    }

    return steps;
  },
};

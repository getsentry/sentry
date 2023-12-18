import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
//...
import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: "${params.dsn}",${
    params.isPerformanceSelected
      ? `
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions`
      : ''
  }
});`;

const getVerifySnippet = () => `try {
  throw new Error('Sentry Bun test');
} catch (e) {
  Sentry.captureException(e);
}`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: t(
        "Sentry captures data by using an SDK within your application's runtime."
      ),
      configurations: [
        {
          language: 'bash',
          code: 'bun add @sentry/bun',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          language: 'javascript',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: params =>
    params.isPerformanceSelected
      ? []
      : [
          {
            id: 'performance-monitoring',
            name: t('Performance Monitoring'),
            description: t(
              'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
            ),
            link: 'https://docs.sentry.io/platforms/javascript/guides/bun/performance/',
          },
        ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

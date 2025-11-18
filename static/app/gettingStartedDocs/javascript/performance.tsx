import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {installSnippetBlock, type PlatformOptions} from './utils';

export const performance: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    t(
      "Adding Performance to your Browser JavaScript project is simple. Make sure you've got these basics down."
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our JavaScript browser SDK using either [code:yarn] or [code:npm]:',
            {code: <code />}
          ),
        },
        installSnippetBlock,
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
            "Configuration should happen as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  // Set \`tracePropagationTargets\` to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
`,
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/sampling/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Add Distributed Tracing (Optional)'),
      content: [
        {
          type: 'text',
          text: tct(
            "If you're using the current version of our JavaScript SDK and have enabled the [code: BrowserTracing] integration, distributed tracing will work out of the box. To get around possible [link:Browser CORS] issues, define your [code:tracePropagationTargets].",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
`,
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
          text: tct(
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your JavaScript application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

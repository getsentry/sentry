import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallSnippet} from './utils';

export const performance: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your React project is simple. Make sure you've got these basics down."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Install the Next.js SDK using our installation wizard:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: getInstallSnippet(params),
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
          text: tct(
            'To configure, set [code:tracesSampleRate] in your config files, [code:sentry.server.config.js], [code:instrumentation-client.(js|ts)], and [code:sentry.edge.config.js]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${params.dsn.public}",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});
`,
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/" />
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
            "If you're using the current version of our Next.js SDK, distributed tracing will work out of the box for the client, server, and edge runtimes.[break][break]For client-side you might have to define [code: tracePropagationTargets] to get around possible [link:Browser CORS] issues.",
            {
              break: <br />,
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
// instrumentation-client.(js|ts)
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [Sentry.browserTracingIntegration()],
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]
});
`,
        },
        {
          type: 'text',
          text: tct(
            "If you're using version [code:7.57.x] or below, you'll need to have our [link:tracing feature enabled] in order for distributed tracing to work.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/" />
              ),
            }
          ),
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
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your NextJS application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

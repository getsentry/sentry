import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallCodeBlock, getSdkInitSnippet} from './utils';

export const performance: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Node project is simple. Make sure you've got these basics down."
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install our Node.js SDK using [code:npm] or [code:yarn]', {
            code: <code />,
          }),
        },
        getInstallCodeBlock(params),
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
            'Sentry should be initialized as early in your app as possible. It is essential that you call [code:Sentry.init] before you require any other modules in your application—otherwise, auto-instrumentation of these modules will [strong:not] work.',
            {code: <code />, strong: <strong />}
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs] and make sure to import it in your apps entrypoint before anything else.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'instrument.(js|mjs)',
              language: 'javascript',
              code: getSdkInitSnippet(params, 'node'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/configuration/sampling/" />
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
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Node application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'You have the option to manually construct a transaction using [link:custom instrumentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/custom-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

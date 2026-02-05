import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const metrics: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics for React Native are supported in Sentry React Native SDK version [code:7.8.0] and above. If you are using an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/migration/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install --save @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.8.0'
              )}`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.8.0'
              )}`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/react-native@${getPackageVersion(
                params,
                '@sentry/react-native',
                '7.8.0'
              )}`,
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
            'Metrics are enabled by default once the SDK is initialized. No additional configuration is required.'
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: '${params.dsn.public}',
});`,
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
            'Send test metrics from your app to verify metrics are arriving in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from '@sentry/react-native';

// Counter metric
Sentry.metrics.count('button_click', 1);

// Gauge metric
Sentry.metrics.gauge('queue_depth', 42);

// Distribution metric with unit
Sentry.metrics.distribution('response_time', 187.5, {
  unit: 'millisecond',
});

// Counter with unit and attributes
Sentry.metrics.count('network_request', 1, {
  unit: 'request',
  attributes: {
    endpoint: '/api/users',
    method: 'POST',
  },
});`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

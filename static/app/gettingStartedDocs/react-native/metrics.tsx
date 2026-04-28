import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {installCodeBlock} from './utils';

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 7.8.0. If you already have the SDK installed, you can update it to the latest version with:'
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
          text: t(
            'Metrics are enabled by default once the SDK is initialized. No additional configuration is required.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
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
            'Send test metrics from your app to verify metrics are arriving in Sentry.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

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
          ],
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

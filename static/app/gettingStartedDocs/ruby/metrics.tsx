import {ExternalLink} from '@sentry/scraps/link';

import type {
  BasePlatformOptions,
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const metricsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: t(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      ),
    },
    {
      type: 'code',
      language: 'ruby',
      code: `# Counter metric
Sentry.metrics.count('button_click', value: 1)

# Gauge metric
Sentry.metrics.gauge('queue.depth', 42)

# Distribution metric
Sentry.metrics.distribution('page_load', 15.0,
  unit: 'millisecond',
  attributes: { page: '/home' }
)`,
    },
  ],
});

export const metrics = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
}: {
  docsPlatform: string;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using metrics, make sure your Sentry Ruby SDK version is [code:6.3.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink
                  href={
                    docsPlatform === 'ruby'
                      ? 'https://docs.sentry.io/platforms/ruby/migration/'
                      : `https://docs.sentry.io/platforms/ruby/guides/${docsPlatform}/migration/`
                  }
                />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'gem install sentry-ruby',
        },
      ],
    },
  ],
  configure: () => [],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:Sentry.init] configuration. You can emit metrics using the [code:Sentry.metrics] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: `Sentry.init do |config|
  config.dsn = '${params.dsn.public}'
end

# Counter metric
Sentry.metrics.count('button_click', value: 5, attributes: { browser: 'Firefox', app_version: '1.0.0' })

# Gauge metric
Sentry.metrics.gauge('page_load', 15.0, unit: 'millisecond', attributes: { page: '/home' })

# Distribution metric
Sentry.metrics.distribution('page_load', 15.0, unit: 'millisecond', attributes: { page: '/home' })`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink
                  href={
                    docsPlatform === 'ruby'
                      ? 'https://docs.sentry.io/platforms/ruby/metrics/'
                      : `https://docs.sentry.io/platforms/ruby/guides/${docsPlatform}/metrics/`
                  }
                />
              ),
            }
          ),
        },
      ],
    },
  ],
});

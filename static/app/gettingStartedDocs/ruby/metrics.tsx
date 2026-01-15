import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

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
Sentry::Metrics.count('test-counter', value: 10, attributes: { my_attribute: 'foo'})

# Gauge metric
Sentry::Metrics.gauge('test-gauge', 50.0, unit: 'millisecond', attributes: { my_attribute: 'foo' })

# Distribution metric
Sentry::Metrics.distribution('test-distribution', 20.0, unit: 'kilobyte', attributes: { my_attribute: 'foo' })`,
        },
      ],
    },
  ],
});

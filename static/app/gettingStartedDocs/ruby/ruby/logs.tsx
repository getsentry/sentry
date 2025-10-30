import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs = <PlatformOptions extends BasePlatformOptions = BasePlatformOptions>({
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
            "To start using logs, make sure your Sentry Ruby SDK version is [code:5.24.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
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
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enable_logs] option set to [code:true]. You can also patch the Ruby logger to forward logs to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: `require 'sentry-ruby'

Sentry.init do |config|
  # Enable sending logs to Sentry
  config.enable_logs = true
  # Patch Ruby logger to forward logs
  config.enabled_patches = [:logger]
end`,
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
          text: t('You can use the Ruby stdlib logger to test sending logs to Sentry.'),
        },
        {
          type: 'code',
          language: 'ruby',
          code: `require 'logger'

logger = Logger.new($stdout)
logger.info("Sentry test log from stdlib logger")`,
        },
        {
          type: 'text',
          text: t('You can also use the Sentry logger APIs to send logs to Sentry.'),
        },
        {
          type: 'code',
          language: 'ruby',
          code: `Sentry.logger.info("Test log from %{test_source}", test_source: "Sentry")`,
        },
      ],
    },
  ],
});

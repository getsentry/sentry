import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const onboarding: OnboardingConfig = {
  introduction: () =>
    t(
      'In Rails, all uncaught exceptions will be automatically reported. We support Rails 5 and newer.'
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add [sentryRubyCode:sentry-ruby] and [sentryRailsCode:sentry-rails] to your [sentryGemfileCode:Gemfile]:',
        {
          sentryRubyCode: <code />,
          sentryRailsCode: <code />,
          sentryGemfileCode: <code />,
        }
      ),
      configurations: [
        {
          language: 'ruby',
          code: `
gem "sentry-ruby"
gem "sentry-rails"
          `,
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Initialize the SDK within your [code:config/initializers/sentry.rb]:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'ruby',
          code: `
Sentry.init do |config|
  config.dsn = '${params.dsn}'
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  config.traces_sample_rate = 1.0
  # or
  config.traces_sampler = lambda do |context|
    true
  end
end
          `,
        },
      ],
    },
    {
      title: t('Caveats'),
      description: (
        <p>
          {tct(
            'Currently, custom exception applications [code:(config.exceptions_app)] are not supported. If you are using a custom exception app, you must manually integrate Sentry yourself.',
            {
              code: <code />,
            }
          )}
        </p>
      ),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;

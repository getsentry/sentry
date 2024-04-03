import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getRubyMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
Sentry.init do |config|
  config.dsn = '${params.dsn}'

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  config.traces_sample_rate = 1.0
  # or
  config.traces_sampler = lambda do |context|
    true
  end
end`;

const getVerifySnippet = () => `
begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Sentry Ruby comes as a gem and is straightforward to install. If you are using Bundler just add this to your [code:Gemfile]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'ruby',
          code: 'gem "sentry-ruby"',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To use Sentry Ruby all you need is your DSN. Like most Sentry libraries it will honor the [sentryDSN:SENTRY_DSN] environment variable. You can find it on the project settings page under API Keys. You can either export it as environment variable or manually configure it with [sentryInit:Sentry.init]:',
        {sentryDSN: <code />, sentryInit: <code />}
      ),
      configurations: [
        {
          language: 'ruby',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t('You can then report errors or messages to Sentry:'),
      configurations: [
        {
          language: 'ruby',

          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getRubyMetricsOnboarding(),
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;

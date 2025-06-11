import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

export enum YesNo {
  YES = 'yes',
  NO = 'no',
}

const platformOptions = {
  logsBeta: {
    label: t('Logs Beta'),
    items: [
      {
        label: t('Yes'),
        value: YesNo.YES,
      },
      {
        label: t('No'),
        value: YesNo.NO,
      },
    ],
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

export const getRubyProfilingOnboarding = ({
  frameworkPackage,
}: {frameworkPackage?: string} = {}) => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'We use the [code:stackprof] [stackprofLink:gem] to collect profiles for Ruby.',
        {
          code: <code />,
          stackprofLink: <ExternalLink href="https://github.com/tmm1/stackprof" />,
        }
      ),
      configurations: [
        {
          description: tct(
            'First add [code:stackprof] to your [code:Gemfile] and make sure it is loaded before the Sentry SDK.',
            {
              code: <code />,
            }
          ),
          language: 'ruby',
          code: `
gem 'stackprof'
gem 'sentry-ruby'${
            frameworkPackage
              ? `
gem '${frameworkPackage}'`
              : ''
          }`,
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Then, make sure both [code:traces_sample_rate] and [code:profiles_sample_rate] are set and non-zero in your Sentry initializer.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Ruby',
              value: 'ruby',
              filename: 'config/initializers/sentry.rb',
              language: 'ruby',
              code: `
Sentry.init do |config|
  config.dsn = "${params.dsn.public}"
  config.traces_sample_rate = 1.0
  config.profiles_sample_rate = 1.0
end
                   `,
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
});

const getInstallSnippet = (params: Params) =>
  `${params.isProfilingSelected ? 'gem "stackprof"\n' : ''}gem "sentry-ruby"`;

const getConfigureSnippet = (params: Params) => `
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = '${params.dsn.public}'

  # Add data like request headers and IP for users,
  # see https://docs.sentry.io/platforms/ruby/data-management/data-collected/ for more info
  config.send_default_pii = true${
    params.isPerformanceSelected
      ? `

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for tracing.
  # We recommend adjusting this value in production.
  config.traces_sample_rate = 1.0
  # or
  config.traces_sampler = lambda do |context|
    true
  end`
      : ''
  }${
    params.isProfilingSelected
      ? `
  # Set profiles_sample_rate to profile 100%
  # of sampled transactions.
  # We recommend adjusting this value in production.
  config.profiles_sample_rate = 1.0`
      : ''
  }${
    params.platformOptions.logsBeta === YesNo.YES
      ? `
  # Enable Sentry logs beta feature
  config.enable_logs = true`
      : ''
  }
end`;

const getVerifySnippet = (params: Params) =>
  params.platformOptions.logsBeta === YesNo.YES
    ? `
# Send logs using Sentry logger
Sentry::Logger.info("This is an info log from Sentry")
Sentry::Logger.error("This is an error log from Sentry")

begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")`
    : `
begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")`;

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'The Sentry SDK for Ruby comes as a gem that should be added to your [gemfileCode:Gemfile]:',
        {
          gemfileCode: <code />,
        }
      ),
      configurations: [
        {
          description: params.isProfilingSelected
            ? tct(
                'Ruby Profiling beta is available since SDK version 5.9.0. We use the [stackprofLink:stackprof gem] to collect profiles for Ruby. Make sure [code:stackprof] is loaded before [code:sentry-ruby].',
                {
                  stackprofLink: (
                    <ExternalLink href="https://github.com/tmm1/stackprof" />
                  ),
                  code: <code />,
                }
              )
            : undefined,
          language: 'ruby',
          code: getInstallSnippet(params),
        },
        {
          description: t('After adding the gems, run the following to install the SDK:'),
          language: 'ruby',
          code: 'bundle install',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To use Sentry Ruby all you need is your DSN. Like most Sentry libraries it will honor the [code:SENTRY_DSN] environment variable. You can find it on the project settings page under API Keys. You can either export it as environment variable or manually configure it with [code:Sentry.init]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'ruby',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description:
        params.platformOptions.logsBeta === YesNo.YES
          ? t(
              "This snippet shows how to send logs and includes a deliberate error and message sent to Sentry to test that everything's working as expected."
            )
          : t(
              "This snippet contains a deliberate error and message sent to Sentry and can be used as a test to make sure that everything's working as expected."
            ),
      configurations: [
        {
          language: 'ruby',
          code: getVerifySnippet(params),
        },
      ],
      ...(params.platformOptions.logsBeta === YesNo.YES && {
        additionalInfo: t(
          'With logs enabled, you can now send structured logs to Sentry using the logger APIs. These logs will be automatically linked to errors and traces for better debugging context.'
        ),
      }),
    },
  ],
};

const docs: Docs<PlatformOptions> = {
  platformOptions,
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
  profilingOnboarding: getRubyProfilingOnboarding(),
};

export default docs;

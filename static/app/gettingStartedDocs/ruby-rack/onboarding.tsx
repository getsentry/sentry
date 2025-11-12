import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getInstallSnippet = (params: DocsParams) =>
  `${params.isProfilingSelected ? 'gem "stackprof"\n' : ''}gem "sentry-ruby"`;

const getConfigureSnippet = (params: DocsParams) => `
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = '${params.dsn.public}'

  # Add data like request headers and IP for users,
  # see https://docs.sentry.io/platforms/ruby/data-management/data-collected/ for more info
  config.send_default_pii = true${
    params.isLogsSelected
      ? `

  # Enable sending logs to Sentry
  config.enable_logs = true
  # Patch Ruby logger to forward logs
  config.enabled_patches = [:logger]`
      : ''
  }${
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
  }
end

use Sentry::Rack::CaptureExceptions`;

const getVerifySnippet = () => `
begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")`;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'The Sentry SDK for Ruby comes as a gem that should be added to your [gemfileCode:Gemfile]:',
            {
              gemfileCode: <code />,
            }
          ),
        },
        {
          type: 'conditional',
          condition: params.isProfilingSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'Ruby Profiling beta is available since SDK version 5.9.0. We use the [stackprofLink:stackprof gem] to collect profiles for Ruby. Make sure [code:stackprof] is loaded before [code:sentry-ruby].',
                {
                  stackprofLink: (
                    <ExternalLink href="https://github.com/tmm1/stackprof" />
                  ),
                  code: <code />,
                }
              ),
            },
          ],
        },
        {
          type: 'code',
          language: 'ruby',
          code: getInstallSnippet(params),
        },
        {
          type: 'text',
          text: t('After adding the gems, run the following to install the SDK:'),
        },
        {
          type: 'code',
          language: 'ruby',
          code: 'bundle install',
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
            'Add [code:use Sentry::Rack::CaptureExceptions] to your [code:config.ru] or other rackup file (this is automatically inserted in Rails):',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: getConfigureSnippet(params),
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
            "This snippet contains a deliberate error and message sent to Sentry and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'ruby',
              language: 'ruby',
              code: getVerifySnippet(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [],
};

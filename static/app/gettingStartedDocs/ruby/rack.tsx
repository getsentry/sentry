import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = (params: Params) =>
  `${params.isProfilingSelected ? 'gem "stackprof"\n' : ''}gem "sentry-ruby"`;

const getConfigureSnippet = (params: Params) => `
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = '${params.dsn.public}'${
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

const onboarding: OnboardingConfig = {
  install: params => [
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
        'Add [code:use Sentry::Rack::CaptureExceptions] to your [code:config.ru] or other rackup file (this is automatically inserted in Rails):',
        {
          code: <code />,
        }
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
      description: t(
        "This snippet contains a deliberate error and message sent to Sentry and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          code: [
            {
              label: 'ruby',
              value: 'ruby',
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

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;

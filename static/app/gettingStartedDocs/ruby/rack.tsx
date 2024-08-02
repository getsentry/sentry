import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getRubyMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = (params: Params) =>
  `${params.isProfilingSelected ? 'gem "stackprof"\n' : ''}gem "sentry-ruby"`;

const getConfigureSnippet = (params: Params) => `
require 'sentry-ruby'

Sentry.init do |config|
  config.dsn = '${params.dsn}'${
    params.isPerformanceSelected
      ? `

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
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

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'The Sentry SDK for Ruby comes as a gem and is straightforward to install. If you are using Bundler just add this to your [gemfileCode:Gemfile] and run [bundleCode:bundle install]:',
        {
          gemfileCode: <code />,
          bundleCode: <code />,
        }
      ),
      configurations: [
        {
          description: params.isProfilingSelected
            ? tct(
                'Ruby Profiling beta is available since SDK version 5.9.0. We use the [stackprofLink:stackprof gem] to collect profiles for Ruby. Make sure [stackprofCode:stackprof] is loaded before [sentryRubyCode:sentry-ruby].',
                {
                  stackprofLink: (
                    <ExternalLink href="https://github.com/tmm1/stackprof" />
                  ),
                  stackprofCode: <code />,
                  sentryRubyCode: <code />,
                }
              )
            : undefined,
          language: 'ruby',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Add [sentryRackCode:use Sentry::Rack::CaptureExceptions] to your [sentryConfigCode:config.ru] or other rackup file (this is automatically inserted in Rails):',
        {
          sentryRackCode: <code />,
          sentryConfigCode: <code />,
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
  verify: () => [],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getRubyMetricsOnboarding(),
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;

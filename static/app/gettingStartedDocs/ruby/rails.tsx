import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstBlocksRails,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {getRubyProfilingOnboarding} from 'sentry/gettingStartedDocs/ruby/ruby';
import {t, tct} from 'sentry/locale';
import {getRubyLogsOnboarding} from 'sentry/utils/gettingStartedDocs/ruby';

type Params = DocsParams;

const getInstallSnippet = (
  params: Params
) => `${params.isProfilingSelected ? 'gem "stackprof"\n' : ''}gem "sentry-ruby"
gem "sentry-rails"`;

const generatorSnippet = 'bin/rails generate sentry';

const getConfigureSnippet = (params: Params) => `
Sentry.init do |config|
  config.dsn = '${params.dsn.public}'
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]

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
end`;

const getVerifySnippet = () => `
begin
  1 / 0
rescue ZeroDivisionError => exception
  Sentry.capture_exception(exception)
end

Sentry.capture_message("test message")`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    t(
      'In Rails, all uncaught exceptions will be automatically reported. We support Rails 5 and newer.'
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'The Sentry SDK for Rails comes as two gems that should be added to your [gemfileCode:Gemfile]:',
            {
              gemfileCode: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: getInstallSnippet(params),
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
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Run the following Rails generator to create the initializer file [code:config/initializers/sentry.rb].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'ruby',
          code: generatorSnippet,
        },
        {
          type: 'text',
          text: t('You can then change the Sentry configuration as follows:'),
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

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "In Rails, being able to serve dynamic pages in response to errors is required to pass the needed [codeEvent:event_id] to the JavaScript SDK. [link:Read our docs] to learn more. Once you're able to serve dynamic exception pages, you can support user feedback.",
            {
              codeEvent: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/ruby/guides/rails/user-feedback/#integration" />
              ),
            }
          ),
        },
        ...getCrashReportSDKInstallFirstBlocksRails(params),
        {
          type: 'text',
          text: t('Additionally, you need the template that brings up the dialog:'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'ERB',
              language: 'erb',
              code: `<% sentry_id = request.env["sentry.error_event_id"] %>
<% if sentry_id.present? %>
<script>
Sentry.init({ dsn: "${params.dsn.public}" });
Sentry.showReportDialog({ eventId: "<%= sentry_id %>" });
</script>
<% end %>`,
            },
          ],
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
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/ruby/guides/rails/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
  profilingOnboarding: getRubyProfilingOnboarding({frameworkPackage: 'sentry-rails'}),
  logsOnboarding: getRubyLogsOnboarding({
    docsPlatform: 'rails',
  }),
};

export default docs;

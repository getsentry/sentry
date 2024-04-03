import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstStepRails,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getRubyMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `
gem "sentry-ruby"
gem "sentry-rails"`;

const getConfigureSnippet = (params: Params) => `
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
end`;

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
          code: getInstallSnippet(),
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
          code: getConfigureSnippet(params),
        },
      ],
    },
    {
      title: t('Caveats'),
      description: tct(
        'Currently, custom exception applications [code:(config.exceptions_app)] are not supported. If you are using a custom exception app, you must manually integrate Sentry yourself.',
        {
          code: <code />,
        }
      ),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        "In Rails, being able to serve dynamic pages in response to errors is required to pass the needed [codeEvent:event_id] to the JavaScript SDK. [link:Read our docs] to learn more. Once you're able to serve dynamic exception pages, you can support user feedback.",
        {
          codeEvent: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/ruby/guides/rails/user-feedback/#integration" />
          ),
        }
      ),
      configurations: [
        getCrashReportSDKInstallFirstStepRails(params),
        {
          description: t(
            'Additionally, you need the template that brings up the dialog:'
          ),
          code: [
            {
              label: 'ERB',
              value: 'erb',
              language: 'erb',
              code: `<% sentry_id = request.env["sentry.error_event_id"] %>
<% if sentry_id.present? %>
<script>
  Sentry.init({ dsn: "${params.dsn}" });
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
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/ruby/guides/rails/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getRubyMetricsOnboarding(),
  replayOnboardingJsLoader,
  crashReportOnboarding,
};

export default docs;

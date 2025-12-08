import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstBlocksRails,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: DocsParams) => [
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

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {tct} from 'sentry/locale';

export const crashReport: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        ...getCrashReportSDKInstallFirstBlocks(params),
        {
          type: 'text',
          text: tct(
            'If you are rendering the page from the server, for example on ASP.NET MVC, the [code:Error.cshtml] razor page can be:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'cshtml',
              value: 'html',
              language: 'html',
              code: `@if (SentrySdk.LastEventId != SentryId.Empty) {
  <script>
    Sentry.init({ dsn: "${params.dsn.public}" });
    Sentry.showReportDialog({ eventId: "@SentrySdk.LastEventId" });
  </script>
}`,
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
            link: 'https://docs.sentry.io/platforms/dotnet/guides/aspnet/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

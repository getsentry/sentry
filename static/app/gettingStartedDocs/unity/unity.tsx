import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConsoleExtensions} from 'sentry/components/onboarding/gettingStartedDoc/utils/consoleExtensions';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "Install the package via the [link:Unity Package Manager] using a Git URL to Sentry's SDK repository:",
            {
              link: (
                <ExternalLink href="https://docs.unity3d.com/Manual/upm-ui-giturl.html" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: 'https://github.com/getsentry/unity.git',
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: tct(
            'The Unity SDK now supports line numbers for IL2CPP. The feature is currently in beta, but you can enable it at [code:Tools -> Sentry -> Advanced -> IL2CPP] line numbers. To learn more check out our [link:docs].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/configuration/il2cpp/" />
              ),
            }
          ),
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
            "Access the Sentry configuration window by going to Unity's top menu: [code:Tools] > [code:Sentry] and enter the following DSN:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: params.dsn.public,
        },
        {
          type: 'text',
          text: t("And that's it! Now Sentry can capture errors automatically."),
        },
        {
          type: 'text',
          text: tct(
            'If you like additional contexts you could enable [link:Screenshots].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/enriching-events/screenshots/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Once it is configured with the DSN you can call the SDK from anywhere:'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getVerifySnippet(),
        },
      ],
    },
    {
      title: t('Troubleshooting'),
      content: [
        {
          type: 'text',
          text: t(
            "Confirm the URL doesn't have a trailing whitespace at the end. The Unity Package Manager will fail to find the package if a trailing whitespace is appended."
          ),
        },
        {
          type: 'text',
          text: tct(
            "If you're running into any kind of issue please check out our [troubleshootingLink:troubleshooting page] or [raiseAnIssueLink:raise an issue].",
            {
              troubleshootingLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/troubleshooting/" />
              ),
              raiseAnIssueLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-unity/issues/new?assignees=&labels=Platform%3A+Unity%2CType%3A+Bug&template=bug.md" />
              ),
            }
          ),
        },
      ],
    },
    getConsoleExtensions(params),
    {
      title: t('Further Settings'),
      content: [
        {
          type: 'custom',
          content: (
            <StoreCrashReportsConfig
              organization={params.organization}
              projectSlug={params.project.slug}
            />
          ),
        },
      ],
    },
  ],
};

export const feedbackOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'C#',
              value: 'csharp',
              language: 'csharp',
              code: `var eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.");

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User");`,
            },
            {
              label: 'F#',
              value: 'fsharp',
              language: 'fsharp',
              code: `let eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.")

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User")`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboarding,
  crashReportOnboarding: feedbackOnboarding,
};

export default docs;

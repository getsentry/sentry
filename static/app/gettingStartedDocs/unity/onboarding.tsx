import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConsoleExtensions} from 'sentry/components/onboarding/gettingStartedDoc/utils/consoleExtensions';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");`;

export const onboarding: OnboardingConfig = {
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
          type: 'conditional',
          condition: params.isLogsSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'To enable structured logging, check the [code:Enable Logs] option in the Sentry configuration window.',
                {code: <code />}
              ),
            },
          ],
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
  verify: (params: DocsParams) => [
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
    ...(params.isLogsSelected
      ? ([
          {
            title: t('Logs'),
            content: [
              {
                type: 'text',
                text: t(
                  'Once logging is enabled, you can send logs using the Debug.Log API or directly via the SDK:'
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: `using Sentry;
using UnityEngine;

// Unity's Debug.Warning (and higher severity levels) will automatically be captured
Debug.Warning("This warning will be sent to Sentry");

// Or use the SDK directly
SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("An error log message");`,
              },
              {
                type: 'text',
                text: tct('Check out [link:the Logs documentation] to learn more.', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/unity/logs/" />
                  ),
                }),
              },
            ],
          },
        ] satisfies OnboardingStep[])
      : []),
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
    ...([getConsoleExtensions(params)].filter(Boolean) as OnboardingStep[]),
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

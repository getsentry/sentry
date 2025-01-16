import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getStoreCrashReportsCallout} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import exampleSnippets from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsExampleSnippets';
import {metricTagsExplanation} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getVerifySnippet = () => `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");`;

const getMetricsConfigureSnippet = () => `
public override void Configure(SentryUnityOptions options)
{
    options.ExperimentalMetrics = new ExperimentalMetricsOptions
    {
      EnableCodeLocations = true
    };
}`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        "Install the package via the [link:Unity Package Manager] using a Git URL to Sentry's SDK repository:",
        {
          link: (
            <ExternalLink href="https://docs.unity3d.com/Manual/upm-ui-giturl.html" />
          ),
        }
      ),
      configurations: [
        {
          language: 'url',
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: `https://github.com/getsentry/unity.git#${getPackageVersion(
            params,
            'sentry.dotnet.unity',
            '1.5.0'
          )}`,
        },
      ],
      additionalInfo: (
        <AlertWithoutMarginBottom type="info">
          {tct(
            'The Unity SDK now supports line numbers for IL2CPP. The feature is currently in beta, but you can enable it at [code:Tools -> Sentry -> Advanced -> IL2CPP] line numbers. To learn more check out our [link:docs].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/configuration/il2cpp/" />
              ),
            }
          )}
        </AlertWithoutMarginBottom>
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Access the Sentry configuration window by going to Unity's top menu: [code:Tools] > [code:Sentry] and enter the following DSN:",
        {code: <code />}
      ),
      configurations: [
        {
          language: 'url',
          code: params.dsn.public,
        },
      ],
      additionalInfo: (
        <Fragment>
          <p>{t("And that's it! Now Sentry can capture errors automatically.")}</p>
          {tct('If you like additional contexts you could enable [link:Screenshots].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/unity/enriching-events/screenshots/" />
            ),
          })}
        </Fragment>
      ),
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: t(
        'Once it is configured with the DSN you can call the SDK from anywhere:'
      ),
      configurations: [
        {
          language: 'csharp',
          code: getVerifySnippet(),
        },
      ],
    },
    getStoreCrashReportsCallout(params),
    {
      title: t('Troubleshooting'),
      description: (
        <Fragment>
          <p>
            {t(
              "Confirm the URL doesn't have a trailing whitespace at the end. The Unity Package Manager will fail to find the package if a trailing whitespace is appended."
            )}
          </p>
          {tct(
            "If you're running into any kind of issue please check out our [troubleshootingLink:troubleshooting page] or [raiseAnIssueLink:raise an issue].",
            {
              troubleshootingLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/troubleshooting/" />
              ),
              raiseAnIssueLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-unity/issues/new?assignees=&labels=Platform%3A+Unity%2CType%3A+Bug&template=bug.md" />
              ),
            }
          )}
        </Fragment>
      ),
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

const metricsOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:2.0.0] of the Unity SDK installed.',
        {
          codeVersion: <code />,
        }
      ),
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Once the SDK is installed or updated, you can enable the experimental metrics feature and code locations being emitted in your RuntimeConfiguration.'
      ),
      configurations: [
        {
          language: 'csharp',
          code: getMetricsConfigureSnippet(),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [code:counters], [code:sets], [code:distributions], [code:gauges], and [code:timings].",
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'csharp',
              code: exampleSnippets.dotnet.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'csharp',
              code: exampleSnippets.dotnet.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'csharp',
              code: exampleSnippets.dotnet.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'csharp',
              code: exampleSnippets.dotnet.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboarding,
  crashReportOnboarding: feedbackOnboarding,
  customMetricsOnboarding: metricsOnboarding,
};

export default docs;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;

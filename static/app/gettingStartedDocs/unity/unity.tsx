import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getVerifySnippet = () => `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");`;

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
        "Access the Sentry configuration window by going to Unity's top menu: [toolsCode:Tools] > [sentryCode:Sentry] and enter the following DSN:",
        {toolsCode: <code />, sentryCode: <code />}
      ),
      configurations: [
        {
          language: 'url',
          code: params.dsn,
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
  verify: () => [
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

const docs: Docs = {
  onboarding,
};

export default docs;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;

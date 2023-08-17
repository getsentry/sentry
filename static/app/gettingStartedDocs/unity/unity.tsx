import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
  sourcePackageRegistries,
}: Partial<
  Pick<ModuleProps, 'dsn' | 'sourcePackageRegistries'>
> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          "Install the package via the [link:Unity Package Manager] using a Git URL to Sentry's SDK repository:",
          {
            link: (
              <ExternalLink href="https://docs.unity3d.com/Manual/upm-ui-giturl.html" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `https://github.com/getsentry/unity.git#${
          sourcePackageRegistries?.isLoading
            ? t('\u2026loading')
            : sourcePackageRegistries?.data?.['sentry.dotnet.unity']?.version ?? '1.5.0'
        }`,
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
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          "Access the Sentry configuration window by going to Unity's top menu: [toolsCode:Tools] > [sentryCode:Sentry] and enter the following DSN:",
          {toolsCode: <code />, sentryCode: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: dsn,
      },
    ],
    additionalInfo: (
      <Fragment>
        {t("And that's it! Now Sentry can capture errors automatically.")}
        <p>
          {tct('If you like additional contexts you could enable [link:Screenshots].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/unity/enriching-events/screenshots/" />
            ),
          })}
        </p>
      </Fragment>
    ),
  },
  {
    type: StepType.VERIFY,
    description: t(
      'Once it is configured with the DSN you can call the SDK from anywhere:'
    ),
    configurations: [
      {
        language: 'csharp',

        code: `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");
        `,
      },
    ],
  },
  {
    title: t('Troubleshooting'),
    description: (
      <Fragment>
        {t(
          "Confirm the URL doesn't have a trailing whitespace at the end. The Unity Package Manager will fail to find the package if a trailing whitespace is appended."
        )}
        <p>
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
        </p>
      </Fragment>
    ),
  },
];
// Configuration End

export function GettingStartedWithUnity({
  dsn,
  sourcePackageRegistries,
  ...props
}: ModuleProps) {
  return <Layout steps={steps({dsn, sourcePackageRegistries})} {...props} />;
}

export default GettingStartedWithUnity;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;

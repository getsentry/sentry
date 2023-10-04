import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';
import type {Organization, PlatformKey} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

export const steps = ({
  sentryInitContent,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Electron SDK package as a dependency:'),
    configurations: [
      {
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: 'npm install --save @sentry/electron',
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: 'yarn add @sentry/electron',
          },
        ],
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          `You need to call [codeInit:Sentry.init] in the [codeMain:main] process and in every [codeRenderer:renderer] process you spawn.
           For more details about configuring the Electron SDK [docsLink:click here].`,
          {
            codeInit: <code />,
            codeMain: <code />,
            codeRenderer: <code />,
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/electron";

        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
    ...props,
  }),
  {
    type: StepType.VERIFY,
    description: t(
      `One way to verify your setup is by intentionally causing an error that breaks your application.`
    ),
    configurations: [
      {
        description: t(
          `Calling an undefined function will throw a JavaScript exception:`
        ),
        language: 'javascript',
        code: `
        myUndefinedFunction();
        `,
      },
      {
        description: t(
          `With Electron you can test native crash reporting by triggering a crash:`
        ),
        language: 'javascript',
        code: `
        process.crash();
      `,
      },
    ],
    additionalInfo: t(
      'You may want to try inserting these code snippets into both your main and any renderer processes to verify Sentry is operational in both.'
    ),
  },
];

// Configuration End

export function GettingStartedWithElectron({
  dsn,
  organization,
  platformKey,
  projectId,
  newOrg,
  ...props
}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`];

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        platformKey,
        projectId,
        newOrg,
      })}
      nextSteps={[]}
      newOrg={newOrg}
      platformKey={platformKey}
      {...props}
    />
  );
}

export default GettingStartedWithElectron;

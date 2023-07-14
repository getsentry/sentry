import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Electron SDK package as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn
yarn add @sentry/electron

# Using npm
npm install --save @sentry/electron
        `,
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
  // TODO: This step isn't in the original onboarding wizard. Can we just reuse the wizard step? (Still waiting on answers from team)
  getUploadSourceMapsStep(
    'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/'
  ),
  {
    type: StepType.VERIFY,
    description: t(
      `One way to verify your setup is by intentionally causing an error that breaks your application.
      Calling an undefined function will throw an exception:`
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        myUndefinedFunction();
        `,
      },
    ],
    additionalInfo: t(
      'You may want to try inserting this code snippet into both your main and any renderer processes to verify Sentry is operational in both.'
    ),
  },
];

// Configuration End

export function GettingStartedWithElectron({dsn, ...props}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`];

  return (
    <Layout
      steps={steps({sentryInitContent: sentryInitContent.join('\n')})}
      nextSteps={[]}
      {...props}
    />
  );
}

export default GettingStartedWithElectron;

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  organization: Organization;
  projectId: string;
  newOrg?: boolean;
  platformKey?: PlatformKey;
  sentryInitContent?: string;
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
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
    ...props,
  }),
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

export function GettingStartedWithElectron({
  dsn,
  organization,
  platformKey,
  projectId,
  newOrg,
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
    />
  );
}

export default GettingStartedWithElectron;

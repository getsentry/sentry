import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`;

export const steps = ({
  sentryInitContent,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Serverless SDK as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn
yarn add @sentry/serverless

# Using npm
npm install --save @sentry/serverless
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct("Wrap your lambda handler with Sentry's [code:wraphandler] function:", {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/serverless");

        Sentry.AWSLambda.init({
          ${sentryInitContent},
        });

        exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
          // Your handler code
        });
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/node/sourcemaps/',
    ...props,
  }),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
          throw new Error("This should show up in Sentry!")
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithAwsLambda({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`, performanceOtherConfig];

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithAwsLambda;

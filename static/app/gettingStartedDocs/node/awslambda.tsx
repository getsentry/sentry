import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Node SDK as a dependency:'),
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
  getUploadSourceMapsStep('https://docs.sentry.io/platforms/node/sourcemaps/'),
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

export function GettingStartedWithAwsLambda({dsn, ...props}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`, performanceOtherConfig];

  return (
    <Layout steps={steps({sentryInitContent: sentryInitContent.join('\n')})} {...props} />
  );
}

export default GettingStartedWithAwsLambda;

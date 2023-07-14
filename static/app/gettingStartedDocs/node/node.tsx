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
yarn add @sentry/node

# Using npm
npm install --save @sentry/node
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          "Initialize Sentry as early as possible in your application's lifecycle, for example in your [code:index.ts/js] entry point:",
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        const Sentry = require("@sentry/node");
        // or use ESM import statements
        // import * as Sentry from '@sentry/node';

        Sentry.init({
          ${sentryInitContent}
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
        const transaction = Sentry.startTransaction({
          op: "test",
          name: "My First Test Transaction",
        });

        setTimeout(() => {
          try {
            foo();
          } catch (e) {
            Sentry.captureException(e);
          } finally {
            transaction.finish();
          }
        }, 99);
        `,
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'profiling',
    name: t('Profiling'),
    description: t(
      'Learn how to configure our Profiling integration and start profiling your code.'
    ),
    link: 'https://docs.sentry.io/platforms/node/profiling/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/node/performance/',
  },
  {
    id: 'source-maps',
    name: t('Source Maps'),
    description: t('Learn how to enable readable stack traces in your Sentry errors.'),
    link: 'https://docs.sentry.io/platforms/node/sourcemaps/',
  },
];

export function GettingStartedWithNode({dsn, ...props}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}",`, performanceOtherConfig];

  return (
    <Layout
      steps={steps({sentryInitContent: sentryInitContent.join('\n')})}
      nextSteps={nextSteps}
      {...props}
    />
  );
}

export default GettingStartedWithNode;

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const replayIntegration = `
new Sentry.Replay(),
`;

const replayOtherConfig = `
// Session Replay
replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
`;

const performanceIntegration = `
new Sentry.BrowserTracing({
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", "https:yourserver.io/api/"],
}),
`;

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!
`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    language: 'bash',
    type: StepType.INSTALL,
    configurations: [
      {
        description: t(
          'Sentry captures data by using an SDK within your application’s runtime.'
        ),
        code: `
        # Using yarn
        yarn add @sentry/react

        # Using npm
        npm install --save @sentry/react
        `,
      },
    ],
  },
  {
    language: 'javascript',
    type: StepType.CONFIGURE_SDK,
    configurations: [
      {
        description: t(
          "Initialize Sentry as early as possible in your application's lifecycle."
        ),
        code: `
        Sentry.init({
          ${sentryInitContent}
        });

        const container = document.getElementById(“app”);
        const root = createRoot(container);
        root.render(<App />)
        `,
      },
    ],
  },
  {
    language: 'bash',
    type: StepType.CONFIGURE_SOURCE_MAPS,
    configurations: [
      {
        description: t(
          'Use Sentry Wizard to configure Source Maps upload, enabling readable stack traces in Sentry errors.'
        ),
        code: `npx @sentry/wizard@latest -i sourcemaps`,
        additionalInfo: (
          <Alert type="info" showIcon noBottomSpacing>
            {tct('Prefer to set up Source Maps manually? [docsLink:Read the docs].', {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/" />
              ),
            })}
          </Alert>
        ),
      },
    ],
  },
  {
    language: 'javascript',
    type: StepType.VERIFY,
    configurations: [
      {
        description: t(
          "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
        ),
        code: `
        return <button onClick={() => methodDoesNotExist()}>Break the world</button>;
        `,
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'react-features',
    name: t('React Features'),
    description: t('Learn about our first class integration with the React framework.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
  },
  {
    id: 'react-router',
    name: t('React Router'),
    description: t(
      'Configure routing, so Sentry can generate parameterized transaction names for a better overview in Performance Monitoring.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/react/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/react/session-replay/',
  },
];
// Configuration End

type Props = {
  activeProductSelection: ProductSolution[];
  dsn: string;
  newOrg?: boolean;
};

export default function GettingStartedWithReact({
  dsn,
  activeProductSelection,
  newOrg,
}: Props) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];
  let nextStepDocs = [...nextSteps];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    integrations.push(performanceIntegration.trim());
    otherConfigs.push(performanceOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (activeProductSelection.includes(ProductSolution.SESSION_REPLAY)) {
    integrations.push(replayIntegration.trim());
    otherConfigs.push(replayOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }

  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({sentryInitContent: sentryInitContent.join('\n')})}
      nextSteps={nextStepDocs}
      newOrg={newOrg}
    />
  );
}

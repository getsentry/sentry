import {Layout, StepType} from 'sentry/components/onboarding/gettingStartedDoc';
import {PRODUCT} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';

type Props = {
  activeProductSelection: PRODUCT[];
  dsn: string;
};

export default function GettingStartedWithReact({dsn, activeProductSelection}: Props) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];
  const nextSteps = [
    {
      name: t('Source Maps'),
      description: t('Learn how to enable readable stack traces in your Sentry errors.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
    },
    {
      name: t('React Features'),
      description: t('Learn about our first class integration with the React framework.'),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/features/',
    },
  ];

  if (activeProductSelection.includes(PRODUCT.PERFORMANCE_MONITORING)) {
    integrations.push(
      `new Sentry.BrowserTracing({
        // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: ["localhost", "https:yourserver.io/api/"],
      }),`
    );
    otherConfigs.push(
      `// Performance Monitoring
      tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`
    );
  } else {
    nextSteps.push({
      name: t('Performance Monitoring'),
      description: t(
        'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/performance/',
    });
  }

  if (activeProductSelection.includes(PRODUCT.SESSION_REPLAY)) {
    integrations.push('new Sentry.Replay(),');
    otherConfigs.push(
      `// Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
    );
  } else {
    nextSteps.push({
      name: t('Session Replay'),
      description: t(
        'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/session-replay/',
    });
  }

  if (integrations.length > 0) {
    integrations.unshift('integrations: [');
    integrations.push('],');
  }

  const sentryInitContent: string[] = [`dsn: "${dsn}"`];

  if (integrations.length > 0) {
    sentryInitContent.push(integrations.join('\n'));
  }

  if (otherConfigs.length > 0) {
    sentryInitContent.push(otherConfigs.join('\n'));
  }

  return (
    <Layout
      language="javascript"
      steps={[
        {
          type: StepType.INSTALL,
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
        {
          type: StepType.CONFIGURE,
          description: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
          code: `
          Sentry.init({
            ${sentryInitContent.join('\n')}
          });

          const container = document.getElementById(“app”);
          const root = createRoot(container);
          root.render(<App />)
          `,
        },
        {
          type: StepType.VERIFY,
          description: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
          code: `
          return <button onClick={() => methodDoesNotExist()}>Break the world</button>;
          `,
        },
      ]}
      nextSteps={nextSteps}
    />
  );
}

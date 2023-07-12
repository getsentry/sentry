import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
new Sentry.BrowserTracing(),
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
    type: StepType.INSTALL,
    description: tct(
      'Add Sentry automatically to your app with the [wizardLink:Sentry wizard].',
      {
        wizardLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#install" />
        ),
      }
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard -i nextjs`,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <ConfigureDescription>
        {t('The Sentry wizard will automatically patch your application:')}
        <List symbol="bullet">
          <ListItem>
            {tct(
              'Create [code:sentry.client.config.js] and [code:sentry.server.config.js] with the default [code:Sentry.init].',
              {
                code: <code />,
              }
            )}
          </ListItem>
          <ListItem>
            {tct('Create [code:next.config.js] with the default configuration.', {
              code: <code />,
            })}
          </ListItem>
          <ListItem>
            {tct(
              'Create [code:sentry.properties] with configuration for sentry-cli (which is used when automatically uploading source maps).',
              {
                code: <code />,
              }
            )}
          </ListItem>
        </List>
        <div>
          {tct('Alternatively, you can also [manualSetupLink:set up the SDK manually].', {
            manualSetupLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
            ),
          })}
        </div>
      </ConfigureDescription>
    ),
    configurations: [
      {
        description: (
          <ConfigureDescription>
            <strong>{t('Configure the Sentry SDK:')}</strong>
            <div>
              {tct(
                'Install Sentry’s Next.js SDK using either [code:yarn] or [code:npm]:',
                {
                  code: <code />,
                }
              )}
            </div>
          </ConfigureDescription>
        ),
        language: 'bash',
        code: `
        yarn add @sentry/nextjs
        # or
        npm install --save @sentry/nextjs
        `,
      },
      {
        language: 'javascript',
        code: `
        Sentry.init({
          ${sentryInitContent}
        });
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        return <button onClick={() => methodDoesNotExist()}>Break the world</button>;
        `,
      },
    ],
  },
];

export const nextSteps = [
  {
    id: 'source-maps',
    name: t('Source Maps'),
    description: t('Learn how to enable readable stack traces in your Sentry errors.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/',
  },
];
// Configuration End

export function GettingStartedWithNextJs({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
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
      {...props}
    />
  );
}

export default GettingStartedWithNextJs;

const ConfigureDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

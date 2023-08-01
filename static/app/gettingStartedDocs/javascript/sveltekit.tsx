import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
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
    description: (
      <p>
        {tct('Configure your app automatically with the [wizardLink:Sentry wizard].', {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/#install" />
          ),
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i sveltekit`,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <Fragment>
        {t(
          'The Sentry wizard will automatically patch your application to configure the Sentry SDK:'
        )}
        <List symbol="bullet">
          <ListItem>
            {tct(
              'Create or update [hookClientCode:src/hooks.client.js] and [hookServerCode:src/hooks.server.js] with the default [sentryInitCode:Sentry.init] call and SvelteKit hooks handlers.',
              {
                hookClientCode: <code />,
                hookServerCode: <code />,
                sentryInitCode: <code />,
              }
            )}
          </ListItem>
          <ListItem>
            {tct(
              'Update [code:vite.config.js] to add source maps upload and auto-instrumentation via Vite plugins.',
              {
                code: <code />,
              }
            )}
          </ListItem>
          <ListItem>
            {tct(
              'Create [sentryClircCode:.sentryclirc] and [sentryPropertiesCode:sentry.properties] files with configuration for sentry-cli (which is used when automatically uploading source maps).',
              {
                sentryClircCode: <code />,
                sentryPropertiesCode: <code />,
              }
            )}
          </ListItem>
        </List>
        <p>
          {tct('Alternatively, you can also [manualSetupLink:set up the SDK manually].', {
            manualSetupLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/manual-setup/" />
            ),
          })}
        </p>
      </Fragment>
    ),
    configurations: [
      {
        description: (
          <Fragment>
            <strong>{t('Configure the Sentry SDK:')}</strong>
            <p>
              {tct(
                'To configure the Sentry SDK, edit the [sentryInitCode:Sentry.init] options in [hooksCode:hooks.(client|server).(js|ts)]:',
                {hooksCode: <code />, sentryInitCode: <code />}
              )}
            </p>
          </Fragment>
        ),
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/sveltekit";

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
        <!-- +page.svelte -->
        <button type="button" on:click={unknownFunction}>Break the world</button>
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
    link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/sourcemaps/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/session-replay/',
  },
];
// Configuration End

export function GettingStartedWithSvelteKit({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];
  let nextStepDocs = [...nextSteps];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
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

export default GettingStartedWithSvelteKit;

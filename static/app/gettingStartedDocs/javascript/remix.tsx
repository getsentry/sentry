import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct("Sentry's integration with [remixLink:Remix] supports Remix 1.0.0 and above.", {
      remixLink: <ExternalLink href="https://remix.run/" />,
    }),
  install: (_params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          description: t(
            'Install and configure the Sentry Remix SDK automatically with our wizard:'
          ),
          language: 'bash',
          code: [
            {
              label: 'bash',
              value: 'bash',
              language: 'bash',
              code: `npx @sentry/wizard@latest -i remix`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'The Sentry wizard will automatically add code to your project to inialize and configure the Sentry SDK:'
      ),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {tct(
                  "Create two files in the root directory of your project, [clientEntry:entry.client.tsx] and [serverEntry:entry.server.tsx] (if they don't already exist).",
                  {
                    clientEntry: <code />,
                    serverEntry: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Add the default [sentryInitCode:Sentry.init] call to both, client and server entry files.',
                  {
                    sentryInitCode: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Create a [cliRc:.sentryclirc] with an auth token to upload source maps (this file is automatically added to your [gitignore:.gitignore]).',
                  {
                    cliRc: <code />,
                    gitignore: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Adjust your [buildscript:build] script in your [pkgJson:package.json] to automatically upload source maps to Sentry when you build your application.',
                  {
                    buildscript: <code />,
                    pkgJson: <code />,
                  }
                )}
              </ListItem>
            </List>
          ),
        },
        {
          description: tct(
            'You can also further [manualConfigure:configure your SDK] or [manualSetupLink:set it up manually], without the wizard.',
            {
              manualConfigure: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/#configuration" />
              ),
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/manual-setup/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/remix/performance/',
    },
    {
      id: 'session-replay',
      name: t('Session Replay'),
      description: t(
        'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/remix/session-replay/',
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;

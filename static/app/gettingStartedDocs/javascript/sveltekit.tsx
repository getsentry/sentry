import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallConfig = () => [
  {
    type: StepType.INSTALL,
    description: tct(
      'Configure your app automatically with the [wizardLink:Sentry wizard].',
      {
        wizardLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/#install" />
        ),
      }
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i sveltekit`,
      },
    ],
  },
];

const onboarding: OnboardingConfig = {
  install: () => getInstallConfig(),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
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
                {tct(
                  'Alternatively, you can also [manualSetupLink:set up the SDK manually].',
                  {
                    manualSetupLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/manual-setup/" />
                    ),
                  }
                )}
              </p>
            </Fragment>
          ),
        },
      ],
    },
  ],
  verify: () => [],
};

const replayOnboarding: OnboardingConfig = {
  install: () => getInstallConfig(),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/sveltekit/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/sveltekit";`,
                dsn: params.dsn,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingNpm: replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
};

export default docs;

import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

export const steps = (): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Configure your app automatically with the [wizardLink:Sentry wizard].', {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#install" />
          ),
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i nextjs`,
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
              'Create [clientCode:sentry.client.config.js] and [serverCode:sentry.server.config.js] with the default [sentryInitCode:Sentry.init].',
              {
                clientCode: <code />,
                serverCode: <code />,
                sentryInitCode: <code />,
              }
            )}
          </ListItem>
          <ListItem>
            {tct(
              'Create or update your Next.js config [nextConfig:next.confg.js] with the default Sentry configuration',
              {
                nextConfig: <code />,
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
          <ListItem>
            {tct('add an example page to your app to verify your Sentry setup', {
              sentryClircCode: <code />,
            })}
          </ListItem>
        </List>
        <p>
          {tct('Alternatively, you can also [manualSetupLink:set up the SDK manually].', {
            manualSetupLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
            ),
          })}
        </p>
      </Fragment>
    ),
  },
];

// Configuration End

export function GettingStartedWithNextJs({...props}: ModuleProps) {
  return <Layout steps={steps()} {...props} />;
}

export default GettingStartedWithNextJs;

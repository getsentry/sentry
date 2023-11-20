import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

type Props = {
  dsn: string;
  organization: Organization | undefined;
  projectSlug: string;
};

export const steps = ({dsn, projectSlug, organization}: Props): LayoutProps['steps'] => [
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
    additionalInfo: (
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
              'Create or update your Next.js config [nextConfig:next.config.js] with the default Sentry configuration.',
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
            {tct('Add an example page to your app to verify your Sentry setup.', {
              sentryClircCode: <code />,
            })}
          </ListItem>
        </List>
        <br />
        <ManualSetupTitle>{t('Manual Setup')}</ManualSetupTitle>
        <p>
          {tct('Alternatively, you can also [manualSetupLink:set up the SDK manually].', {
            manualSetupLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/" />
            ),
          })}
        </p>
        <br />
        <DSNText>
          <p>
            {tct(
              "If you already have the configuration for Sentry in your application, and just need this project's ([projectSlug]) DSN, you can find it below:",
              {
                projectSlug: <code>{projectSlug}</code>,
              }
            )}
          </p>
        </DSNText>
        {organization && (
          <TextCopyInput
            onCopy={() => trackAnalytics('onboarding:nextjs-dsn-copied', {organization})}
          >
            {dsn}
          </TextCopyInput>
        )}
      </Fragment>
    ),
  },
];

// Configuration End

export function GettingStartedWithNextJs({...props}: ModuleProps) {
  const {projectSlug, dsn, organization} = props;

  return <Layout steps={steps({dsn, projectSlug, organization})} {...props} />;
}

export default GettingStartedWithNextJs;

const DSNText = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const ManualSetupTitle = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
`;

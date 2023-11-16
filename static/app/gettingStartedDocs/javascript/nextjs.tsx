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
import type {ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

export const steps = (dsn: string | null, projectSlug: string): LayoutProps['steps'] => [
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
      </Fragment>
    ),
  },
  {
    type: StepType.ALTERNATVE,
    description: (
      <Fragment>
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
              "If you already have the code for Sentry in your application, and just need this project's ([projectSlug]) DSN, you can find it below:",
              {
                projectSlug: <code>{projectSlug}</code>,
              }
            )}
          </p>
        </DSNText>
        <div>{dsn && <TextCopyInput>{dsn}</TextCopyInput>}</div>
      </Fragment>
    ),
  },
];

// Configuration End

export function GettingStartedWithNextJs({...props}: ModuleProps) {
  const {organization, projectSlug} = props;
  const {
    data: projectKeys,
    isError,
    isLoading,
  } = useApiQuery<ProjectKey[]>(
    [`/projects/${organization?.slug}/${projectSlug}/keys/`],
    {
      staleTime: Infinity,
    }
  );

  const dsn = isError || isLoading ? null : projectKeys[0].dsn.public;

  return <Layout steps={steps(dsn, projectSlug)} {...props} />;
}

export default GettingStartedWithNextJs;

const DSNText = styled('div')`
  margin-bottom: ${space(0.5)};
`;

import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    title: t('Creating and Uploading Minidumps'),
    description: (
      <Fragment>
        {t(
          'Depending on your operating system and programming language, there are various alternatives to create minidumps and upload them to Sentry. See the following resources for libraries that support generating minidump crash reports:'
        )}
        <List symbol="bullet">
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/native/">
              Native SDK
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/native/guides/breakpad/">
              Google Breakpad
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/native/guides/crashpad/">
              Google Crashpad
            </ExternalLink>
          </ListItem>
        </List>
      </Fragment>
    ),
    configurations: [
      {
        description: (
          <p>
            {tct(
              'If you have already integrated a library that generates minidumps and would just like to upload them to Sentry, you need to configure the [minidumpEndpointUrlItalic:Minidump Endpoint URL], which can be found at [projectSettingsItalic:Project Settings > Client Keys (DSN)]. This endpoint expects a [postCode:POST] request with the minidump in the [uploadFileMinidumpCode:upload_file_minidump] field:',
              {
                postCode: <code />,
                uploadFileMinidumpCode: <code />,
                minidumpEndpointUrlItalic: <i />,
                projectSettingsItalic: <i />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: `
curl -X POST \
'${dsn}' \
-F upload_file_minidump=@mini.dmp
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'To send additional information, add more form fields to this request. For a full description of fields accepted by Sentry, see [passingAdditionalDataLink:Passing Additional Data].',
          {
            passingAdditionalDataLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/native/guides/minidumps/" />
            ),
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithMinidump({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithMinidump;

import styled from '@emotion/styled';

import devkitCrashesStep1 from 'sentry-images/tempest/devkit-crashes-step1.png';
import devkitCrashesStep2 from 'sentry-images/tempest/devkit-crashes-step2.png';
import devkitCrashesStep3 from 'sentry-images/tempest/devkit-crashes-step3.png';
import windowToolImg from 'sentry-images/tempest/windows-tool-devkit.png';

import {Flex} from 'sentry/components/core/layout/flex';
import {ExternalLink} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {InstallationMode} from 'sentry/gettingStartedDocs/playstation/utils';
import {t, tct} from 'sentry/locale';
import {AddCredentialsButton} from 'sentry/views/settings/project/tempest/addCredentialsButton';
import {
  ALLOWLIST_IP_ADDRESSES_DESCRIPTION,
  AllowListIPAddresses,
} from 'sentry/views/settings/project/tempest/allowListIPAddresses';
import {ConfigForm} from 'sentry/views/settings/project/tempest/configForm';
import {RequestSdkAccessButton} from 'sentry/views/settings/project/tempest/RequestSdkAccessButton';

const isRetailMode = (params: DocsParams) =>
  params.platformOptions?.installationMode === InstallationMode.RETAIL;

const onboardingRetail: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      title: t('Retrieve Back Office Server Credential from Sony'),
      content: [
        {
          type: 'text',
          text: t(
            'Retrieve the Back Office Server Credentials (Client ID and Secret) for the title of interest.'
          ),
        },
        {
          type: 'alert',
          alertType: 'warning',
          showIcon: true,
          text: t(
            'To avoid problems with rate limiting it is preferred to have a separate set of credentials that are only used by Sentry.'
          ),
        },
        {
          type: 'text',
          text: t(
            'Once you have the credentials, save them to your project. You can achieve that by clicking on the button below.'
          ),
        },
        {
          type: 'custom',
          content: (
            <AddCredentialsButton
              project={params.project}
              origin={params.newOrg ? 'onboarding' : 'project-creation'}
            />
          ),
        },
        {
          type: 'text',
          text: tct(
            'After adding credentials, check their status in [projectSettingsLink:Project Settings > PlayStation] to ensure they are valid before proceeding with the instructions below.',
            {
              projectSettingsLink: (
                <ExternalLink
                  href={`/settings/projects/${params.project.slug}/playstation/?tab=retail`}
                  openInNewTab
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      title: t('Allow list our IP Addresses'),
      content: [
        {
          type: 'text',
          text: ALLOWLIST_IP_ADDRESSES_DESCRIPTION,
        },
        {
          type: 'custom',
          content: <AllowListIPAddresses />,
        },
      ],
    },
    {
      title: t('Configure data collection'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'Enable [strong:Attach Dumps] to automatically include Prospero crash dumps for debugging and [strong:Attach Screenshots] to include crash screenshots when available.',
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'warning',
          showIcon: true,
          text: t(
            'Both screenshots and crash dump files consume from your attachments quota.'
          ),
        },
        {
          type: 'custom',
          content: (
            <ConfigForm organization={params.organization} project={params.project} />
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      title: t('Look for events'),
      content: [
        {
          type: 'text',
          text: t(
            'Once you provided credentials, Sentry will make an initial request to verify the credentials are correct and the IPs are allowlisted, if either of these are not the case an error will be displayed in the UI. After that new crashes are pulled once every minute. Events generated from crashes can be filtered using:'
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: `os.name: PlayStation`,
        },
      ],
    },
  ],
};

const onboardingDevkit: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      title: t('Copy PlayStation Ingestion URL'),
      content: [
        {
          type: 'text',
          text: t('This is the URL where your crash reports will be sent:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: params.dsn.playstation,
        },
      ],
    },
  ],
  configure: () => [
    {
      title: t('Using Windows tool to set up Upload URL'),
      content: [
        {
          type: 'text',
          text: t(
            'Using Windows tool enter that link into the DevKit as the URL to the Recap Server.'
          ),
        },
        {
          type: 'custom',
          content: (
            <Flex justify="center">
              <CardIllustration src={windowToolImg} alt={t('Windows tool screenshot')} />
            </Flex>
          ),
        },
      ],
    },
    {
      title: t('Using DevKit Directly to set up Upload URL'),
      content: [
        {
          type: 'text',
          text: t(
            "If you haven't done it via Windows tool, you can set up the Upload URL directly in the DevKit. It is under 'Debug Settings' > 'Core Dump' > 'Upload' > 'Upload URL'."
          ),
        },
        {
          type: 'custom',
          content: (
            <Flex direction="column" gap="lg" align="center">
              <CardIllustration
                src={devkitCrashesStep1}
                alt={t('DevKit set up screenshot step 1')}
              />
              <CardIllustration
                src={devkitCrashesStep2}
                alt={t('DevKit set up screenshot step 2')}
              />
              <CardIllustration
                src={devkitCrashesStep3}
                alt={t('DevKit set up screenshot step 3')}
              />
            </Flex>
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      title: t('Important Notes'),
      content: [
        {
          type: 'custom',
          content: (
            <List symbol="bullet">
              <ListItem>
                {t(
                  'If you are trying to re-attempt the upload of a failed crash that occurred before entering the URL it might be that the DevKit still tries to send the crash to the previously specified URL.'
                )}
              </ListItem>
              <ListItem>
                {t(
                  'There is currently a limit on the size of files we support, as such, uploading large dumps or long videos may fail. During the first setup it is recommended to not send any videos, and once you made sure everything works, you can start sending larger attachments.'
                )}
              </ListItem>
            </List>
          ),
        },
      ],
    },
  ],
};

export const onboarding: OnboardingConfig = {
  install: (params: DocsParams) => {
    return isRetailMode(params)
      ? onboardingRetail.install(params)
      : onboardingDevkit.install(params);
  },
  configure: (params: DocsParams) => {
    return isRetailMode(params)
      ? onboardingRetail.configure(params)
      : onboardingDevkit.configure(params);
  },
  verify: (params: DocsParams) => [
    ...(isRetailMode(params)
      ? onboardingRetail.verify(params)
      : onboardingDevkit.verify(params)),
    {
      title: t('PlayStation SDK (Optional)'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'We offer a PlayStation SDK built on top of [sentryNativeRepoLink:sentry-native], featuring NDA-protected, PlayStation-specific implementations. Use it as a standalone SDK for proprietary engines, or extend your Native, Unreal, or Unity setup. Request access below.',
            {
              sentryNativeRepoLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-native" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: (
            <RequestSdkAccessButton
              organization={params.organization}
              project={params.project}
              origin={params.newOrg ? 'onboarding' : 'project-creation'}
            />
          ),
        },
      ],
    },
  ],
};

const CardIllustration = styled('img')`
  width: 100%;
  max-width: 600px;
  height: auto;
  object-fit: contain;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

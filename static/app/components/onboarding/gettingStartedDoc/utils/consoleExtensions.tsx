import {Fragment} from 'react';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading} from 'sentry/components/core/text';
import {consoleConfig} from 'sentry/components/onboarding/consoleModal';
import type {
  ContentBlock,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import platforms from 'sentry/data/platforms';
import {IconLock} from 'sentry/icons/iconLock';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

const CONSOLE_PLATFORMS = {
  'nintendo-switch': {
    displayName: 'Nintendo Switch',
    repoURL: 'https://github.com/getsentry/sentry-switch',
  },
  playstation: {
    displayName: 'PlayStation',
    repoURL: 'https://github.com/getsentry/playstation',
  },
  xbox: {
    displayName: 'Xbox',
    repoURL: 'https://github.com/getsentry/sentry-xbox',
  },
} as const;

type ConsolePlatformKey = keyof typeof CONSOLE_PLATFORMS;

interface GamingPlatformContentParams {
  consoleKey: ConsolePlatformKey;
  consoleName: string;
  organization: Organization;
  platformName: string;
  projectId: string;
  projectSlug: string;
  repoURL: string;
}

function getGamingPlatformContent({
  organization,
  consoleKey,
  platformName,
  projectSlug,
  projectId,
  consoleName,
  repoURL,
}: GamingPlatformContentParams): ContentBlock[] {
  if (organization.enabledConsolePlatforms?.includes(consoleKey)) {
    return [
      {
        type: 'custom',
        content: (
          <Fragment>
            <Heading as="h3">{consoleName}</Heading>
            {tct(
              'Sentry provides [consoleName] support for [platformName] Engine through a [privateRepoLink: private repository] that extends the main [platformName] SDK with [consoleName]-specific functionality.',
              {
                consoleName,
                platformName,
                privateRepoLink: <ExternalLink href={repoURL} />,
              }
            )}
          </Fragment>
        ),
      },
      {
        type: 'alert',
        alertType: 'warning',
        icon: <IconLock size="sm" locked />,
        text: tct(
          '[strong:Access Restricted]. The [consoleName] extension is distributed through a [privateRepositoryLink:private repository] under NDA.',
          {
            platformName,
            strong: <strong />,
            privateRepositoryLink: <ExternalLink href={repoURL} />,
          }
        ),
        showIcon: true,
        trailingItems: (
          <Button
            size="sm"
            priority="primary"
            onClick={() => {
              openPrivateGamingSdkAccessModal({
                organization,
                projectSlug,
                projectId,
                sdkName: consoleName,
                gamingPlatform: consoleKey,
              });
            }}
          >
            {t('Request Access')}
          </Button>
        ),
      },
      {
        type: 'text',
        text: tct(
          'Once access is granted, the [privateRepositoryLink:private repository] contains instructions for building the extension with [consoleName] Engine.',
          {
            consoleName,
            privateRepositoryLink: <ExternalLink href={repoURL} />,
          }
        ),
      },
    ];
  }

  return [
    {
      type: 'custom',
      content: (
        <Fragment>
          <Heading as="h3">{consoleName}</Heading>
          {consoleConfig[consoleKey]}
        </Fragment>
      ),
    },
  ];
}

interface ConsoleExtensionsParams {
  organization: Organization;
  platform: PlatformKey;
  projectId: string;
  projectSlug: string;
}

export function getConsoleExtensionsCallOut({
  platform,
  organization,
  projectSlug,
  projectId,
}: ConsoleExtensionsParams): OnboardingStep {
  const platformData = platforms.find(p => p.id === platform);
  const platformName = platformData?.name ?? platform;

  const content: ContentBlock[] = [
    {
      type: 'text',
      text: tct(
        'Sentry provides private console extensions that work alongside your [platformName] project. These extensions offer platform-specific optimizations and additional features.',
        {
          platformName,
        }
      ),
    },
  ];

  for (const [consoleKey, consolePlatform] of Object.entries(CONSOLE_PLATFORMS) as Array<
    [ConsolePlatformKey, (typeof CONSOLE_PLATFORMS)[ConsolePlatformKey]]
  >) {
    content.push(
      ...getGamingPlatformContent({
        organization,
        consoleKey,
        projectId,
        projectSlug,
        platformName,
        repoURL: consolePlatform.repoURL,
        consoleName: consolePlatform.displayName,
      })
    );
  }

  return {
    title: t('Console Extensions'),
    collapsible: true,
    content,
  };
}

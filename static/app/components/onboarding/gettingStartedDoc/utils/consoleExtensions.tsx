import {useState} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import {CONSOLE_PLATFORM_INSTRUCTIONS} from 'sentry/components/onboarding/consoleModal';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import type {
  ContentBlock,
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  CONSOLE_PLATFORM_METADATA,
  ConsolePlatform,
} from 'sentry/constants/consolePlatforms';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';

function getPlayStationRequestButtonAccessDescription(platform?: string) {
  switch (platform) {
    case 'unity':
      return tct(
        'We offer an SDK for PlayStation built on top of [sentryNativeRepoLink:sentry-native], featuring NDA-protected, PlayStation-specific implementations that can be used in combination with the Sentry SDK for Unity.',
        {
          sentryNativeRepoLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-native" />
          ),
        }
      );
    case 'unreal':
      return tct(
        'We offer an SDK for PlayStation built on top of [sentryNativeRepoLink:sentry-native], featuring NDA-protected, PlayStation-specific implementations that can be used in combination with the Sentry SDK for Unreal.',
        {
          sentryNativeRepoLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-native" />
          ),
        }
      );
    default:
      return tct(
        'We offer an SDK for PlayStation built on top of [sentryNativeRepoLink:sentry-native], featuring NDA-protected, PlayStation-specific implementations. Use it as a standalone SDK for custom/proprietary engines, or extend your Native, Unreal, or Unity setup.',
        {
          sentryNativeRepoLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-native" />
          ),
        }
      );
  }
}

function getEnabledPlayStationContent(params: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: t('Sentry supports PlayStation on both DevKits and Retail devices.'),
    },
    {
      type: 'text',
      text: tct(
        'For setup instructions and configuration options, visit [projectSettingsLink:Project Settings > PlayStation].',
        {
          projectSettingsLink: (
            <ExternalLink
              href={`/settings/projects/${params.project.slug}/playstation/`}
            />
          ),
        }
      ),
    },
    {
      type: 'text',
      text: <strong>{t('PlayStation SDK (Optional)')}</strong>,
    },
    {
      type: 'text',
      text: getPlayStationRequestButtonAccessDescription(params.project.platform),
    },
    {
      type: 'text',
      text: tct(
        "Even though crash dump collection doesn't require a Sentry SDK, if you add it, you can get additional context in your crash dumps, as well as capture non-fatal events. This allows you to add context such as [breadcrumbsLink:breadcrumbs] and [tagsLink:tags].",
        {
          breadcrumbsLink: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/breadcrumbs/" />
          ),
          tagsLink: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#tags" />
          ),
        }
      ),
    },
    {
      type: 'custom',
      content: (
        <RequestSdkAccessButton
          organization={params.organization}
          projectId={params.project.id}
          origin={params.newOrg ? 'onboarding' : 'project-creation'}
        />
      ),
    },
  ];
}

function getEnabledNintendoSwitchContent(params: DocsParams): ContentBlock[] {
  const metadata = CONSOLE_PLATFORM_METADATA[ConsolePlatform.NINTENDO_SWITCH];
  return [
    {
      type: 'text',
      text: t(
        'Sentry supports Nintendo Switch 1 and 2 on both DevKits and Retail devices.'
      ),
    },
    {
      type: 'text',
      text: <strong>{t('Nintendo Switch SDK (Optional)')}</strong>,
    },
    {
      type: 'text',
      text: tct(
        'Our Sentry Nintendo Switch SDK extends the core [sentryNativeRepositoryLink:sentry-native] library with Nintendo Switch-specific implementations for standalone engines and proprietary game engines.',
        {
          sentryNativeRepositoryLink: (
            <ExternalLink href="https://github.com/getsentry/sentry-native" />
          ),
        }
      ),
    },
    {
      type: 'text',
      text: tct(
        "Even though crash dump collection doesn't require a Sentry SDK, if you add it, you can get additional context in your crash dumps, as well as capture non-fatal events. This allows you to add context such as [breadcrumbsLink:breadcrumbs] and [tagsLink:tags].",
        {
          breadcrumbsLink: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/breadcrumbs/" />
          ),
          tagsLink: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#tags" />
          ),
        }
      ),
    },
    {
      type: 'custom',
      content: (
        <RequestSdkAccessButton
          organization={params.organization}
          projectId={params.project.id}
          origin={params.newOrg ? 'onboarding' : 'project-creation'}
        />
      ),
    },
    {
      type: 'text',
      text: tct(
        "Once access is granted, you'll be able to view detailed instructions and examples for setting up your extension in the [privateRepositoryLink:private repository].",
        {
          privateRepositoryLink: <ExternalLink href={metadata.repoURL} />,
        }
      ),
    },
  ];
}

function getEnabledXboxContent(params: DocsParams): ContentBlock[] {
  const metadata = CONSOLE_PLATFORM_METADATA[ConsolePlatform.XBOX];
  return [
    {
      type: 'text',
      text: t(
        'Sentry supports Xbox One and Series X|S, across both DevKits and Retail devices.'
      ),
    },
    {
      type: 'text',
      text: <strong>{t('Xbox SDK')}</strong>,
    },
    {
      type: 'text',
      text: tct(
        'Our Sentry Xbox SDK extends the core [sentryNativeRepositoryLink:sentry-native] library with Xbox-specific implementations for standalone engines and proprietary game engines.',
        {
          sentryNativeRepositoryLink: (
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
          projectId={params.project.id}
          origin={params.newOrg ? 'onboarding' : 'project-creation'}
        />
      ),
    },
    {
      type: 'text',
      text: tct(
        "Once access is granted, you'll be able to view detailed instructions and examples for setting up your extension in the [privateRepositoryLink:private repository].",
        {
          privateRepositoryLink: <ExternalLink href={metadata.repoURL} />,
        }
      ),
    },
  ];
}

function getContentForPlatform({
  params,
  consolePlatform = ConsolePlatform.NINTENDO_SWITCH,
}: {
  consolePlatform: ConsolePlatform;
  params: DocsParams;
}): ContentBlock[] {
  if (!params.organization.enabledConsolePlatforms?.includes(consolePlatform)) {
    return [
      {
        type: 'custom',
        content: CONSOLE_PLATFORM_INSTRUCTIONS[consolePlatform],
      },
    ];
  }

  if (consolePlatform === ConsolePlatform.PLAYSTATION) {
    return getEnabledPlayStationContent(params);
  }

  if (consolePlatform === ConsolePlatform.XBOX) {
    return getEnabledXboxContent(params);
  }

  return getEnabledNintendoSwitchContent(params);
}

function ConsoleExtensionsContent(params: DocsParams) {
  const [consolePlatform, setConsolePlatform] = useState<ConsolePlatform>(
    ConsolePlatform.NINTENDO_SWITCH
  );

  return (
    <ContentBlocksRenderer
      contentBlocks={[
        {
          type: 'custom',
          content: (
            <SegmentedControl
              aria-label={t('Console Extensions')}
              size="sm"
              value={consolePlatform}
              onChange={setConsolePlatform}
            >
              <SegmentedControl.Item key={ConsolePlatform.NINTENDO_SWITCH}>
                {CONSOLE_PLATFORM_METADATA[ConsolePlatform.NINTENDO_SWITCH].displayName}
              </SegmentedControl.Item>
              <SegmentedControl.Item key={ConsolePlatform.PLAYSTATION}>
                {CONSOLE_PLATFORM_METADATA[ConsolePlatform.PLAYSTATION].displayName}
              </SegmentedControl.Item>
              <SegmentedControl.Item key={ConsolePlatform.XBOX}>
                {CONSOLE_PLATFORM_METADATA[ConsolePlatform.XBOX].displayName}
              </SegmentedControl.Item>
            </SegmentedControl>
          ),
        },
        ...getContentForPlatform({params, consolePlatform}),
      ]}
    />
  );
}
export function getConsoleExtensions(params: DocsParams): OnboardingStep | null {
  if (params.isSelfHosted) {
    return null;
  }

  const platformData = platforms.find(p => p.id === params.platformKey);
  const platformName = platformData?.name ?? params.platformKey;

  return {
    title: t('Console Extensions'),
    content: [
      {
        type: 'text',
        text: tct(
          "Supercharge your [platformName] project with Sentry's exclusive console extensions. Get platform-specific optimizations, enhanced debugging capabilities, and seamless integration designed specifically for console development.",
          {
            platformName,
          }
        ),
      },
      {
        type: 'custom',
        content: <ConsoleExtensionsContent {...params} />,
      },
    ],
  };
}

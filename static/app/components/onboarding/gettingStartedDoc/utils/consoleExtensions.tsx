import {Fragment, useState} from 'react';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {CONSOLE_PLATFORM_INSTRUCTIONS} from 'sentry/components/onboarding/consoleModal';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  CONSOLE_PLATFORM_METADATA,
  ConsolePlatform,
} from 'sentry/constants/consolePlatforms';
import platforms from 'sentry/data/platforms';
import {IconLock} from 'sentry/icons/iconLock';
import {t, tct} from 'sentry/locale';

function ConsolePlatformsContent(params: DocsParams) {
  const [consolePlatform, setConsolePlatform] = useState<ConsolePlatform>(
    ConsolePlatform.NINTENDO_SWITCH
  );

  const consoleData = CONSOLE_PLATFORM_METADATA[consolePlatform];

  return (
    <Flex gap="md" direction="column">
      <div>
        <SegmentedControl
          aria-label={t('Console Platforms')}
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
      </div>
      {params.organization.enabledConsolePlatforms?.includes(consolePlatform) ? (
        <Fragment>
          <p>
            {tct(
              'Our Sentry [repoUrl: [consoleName] SDK] extends the core [sentryNativeRepositoryLink:sentry-native] library with [consoleName]-specific implementations for standalone engines and proprietary game engines.',
              {
                repoUrl: <ExternalLink href={consoleData.repoURL} />,
                consoleName: consoleData.displayName,
                sentryNativeRepositoryLink: (
                  <ExternalLink href="https://github.com/getsentry/sentry-native" />
                ),
              }
            )}
          </p>
          <Alert
            type="warning"
            icon={<IconLock size="sm" locked />}
            showIcon
            trailingItems={
              <Button
                size="sm"
                priority="primary"
                onClick={() => {
                  openPrivateGamingSdkAccessModal({
                    organization: params.organization,
                    projectSlug: params.project.slug,
                    projectId: params.project.id,
                    sdkName: consoleData.displayName,
                    gamingPlatform: consolePlatform,
                  });
                }}
              >
                {t('Request Access')}
              </Button>
            }
          >
            {tct(
              '[strong:Access Restricted]. The [consoleName] SDK is distributed through a private repository under NDA.',
              {
                strong: <strong />,
                consoleName: consoleData.displayName,
              }
            )}
          </Alert>
          <p>
            {t('Once the access is granted, you can proceed with the SDK integration.')}
          </p>
        </Fragment>
      ) : (
        CONSOLE_PLATFORM_INSTRUCTIONS[consolePlatform]
      )}
    </Flex>
  );
}
export function getConsoleExtensions(params: DocsParams): OnboardingStep {
  const platformData = platforms.find(p => p.id === params.platformKey);
  const platformName = platformData?.name ?? params.platformKey;

  return {
    title: t('Console Extensions'),
    collapsible: true,
    content: [
      {
        type: 'text',
        text: tct(
          'Sentry provides private console extensions that work alongside your [platformName] project. These extensions offer platform-specific optimizations and additional features.',
          {
            platformName,
          }
        ),
      },
      {
        type: 'custom',
        content: <ConsolePlatformsContent {...params} />,
      },
    ],
  };
}

import {css} from '@emotion/react';
import styled from '@emotion/styled';

import replayInlineOnboarding from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type OnboardingCTAProps = {
  platform: PlatformKey;
  projectId: string;
};

export default function ReplayInlineOnboardingPanel({
  platform,
  projectId,
}: OnboardingCTAProps) {
  const organization = useOrganization();
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  const platformKey = platforms.find(p => p.id === platform) ?? otherPlatform;
  const platformName = platformKey === otherPlatform ? '' : platformKey.name;

  const {isLoading, isError, isPromptDismissed, dismissPrompt, snoozePrompt} = usePrompt({
    feature: 'issue_replay_inline_onboarding',
    organization,
    projectId,
    daysToSnooze: 7,
  });

  if (isLoading || isError || isPromptDismissed) {
    return null;
  }

  return (
    <FoldSection sectionKey={SectionKey.REPLAY} title={t('Session Replay')}>
      <Container
        position="relative"
        border="primary"
        radius="md"
        padding="xl"
        margin="md 0"
        css={theme => css`
          background: linear-gradient(
            90deg,
            color-mix(in srgb, ${theme.tokens.background.secondary} 0%, transparent) 0%,
            ${theme.tokens.background.secondary} 70%,
            ${theme.tokens.background.secondary} 100%
          );
        `}
      >
        <Stack gap="lg">
          <Stack gap="md">
            <Text as="div" size="xl" bold>
              {tct('Set up your [platform] app with Session Replay', {
                platform: (
                  <Text as="span" variant="accent" bold>
                    {platformName}
                  </Text>
                ),
              })}
            </Text>
            <Container maxWidth="340px">
              {t('Watch the errors and latency issues your users face')}
            </Container>
          </Stack>
          <Flex gap="md">
            <Button
              analyticsEventName="Clicked Replay Onboarding CTA Set Up Button in Issue Details"
              analyticsEventKey="issue_details.replay-onboarding-cta-set-up-button-clicked"
              analyticsParams={{platform}}
              onClick={() => activateSidebar(projectId)}
            >
              {t('Set Up Now')}
            </Button>
          </Flex>
        </Stack>
        <Container
          display={{zero: 'none', xl: 'flex'}}
          justifySelf="end"
          position="absolute"
          top="0"
          right="25px"
          height="100%"
          width="100%"
          maxWidth="250px"
        >
          <Image
            src={replayInlineOnboarding}
            alt=""
            width="100%"
            height="100%"
            objectFit="contain"
          />
        </Container>
        <CloseDropdownMenu
          position="bottom-end"
          trigger={triggerProps => (
            <OverlayTrigger.IconButton
              {...triggerProps}
              variant="transparent"
              icon={<IconClose variant="muted" />}
              aria-label={t('Close')}
            />
          )}
          size="xs"
          items={[
            {
              key: 'dismiss',
              label: t('Dismiss'),
              onAction: () => {
                dismissPrompt();
                trackAnalytics('issue-details.replay-cta-dismiss', {
                  organization,
                  type: 'dismiss',
                });
              },
            },
            {
              key: 'snooze',
              label: t('Snooze'),
              onAction: () => {
                snoozePrompt();
                trackAnalytics('issue-details.replay-cta-dismiss', {
                  organization,
                  type: 'snooze',
                });
              },
            },
          ]}
        />
      </Container>
    </FoldSection>
  );
}

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.md};
  color: ${p => p.theme.colors.white};
  cursor: pointer;
  z-index: 1;
`;

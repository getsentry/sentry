import styled from '@emotion/styled';

import replayInlineOnboarding from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);

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
    <InterimSection type={SectionKey.REPLAY} title={t('Session Replay')}>
      <BannerWrapper>
        <div>
          <BannerTitle>
            {tct('Set up your [platform] app with Session Replay', {
              platform: <PurpleText>{platformName}</PurpleText>,
            })}
          </BannerTitle>
          <BannerDescription>
            {t('Watch the errors and latency issues your users face')}
          </BannerDescription>
          <ActionButton>
            <Button
              type="button"
              analyticsEventName="Clicked Replay Onboarding CTA Set Up Button in Issue Details"
              analyticsEventKey="issue_details.replay-onboarding-cta-set-up-button-clicked"
              analyticsParams={{platform}}
              onClick={() => activateSidebar(projectId)}
            >
              {t('Set Up Now')}
            </Button>
          </ActionButton>
        </div>
        {!isScreenSmall && <Background image={replayInlineOnboarding} />}
        <CloseDropdownMenu
          position="bottom-end"
          triggerProps={{
            showChevron: false,
            borderless: true,
            icon: <IconClose color="subText" />,
          }}
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
      </BannerWrapper>
    </InterimSection>
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin: ${space(1)} 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 340px;
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

const Background = styled('div')<{image: any}>`
  display: flex;
  justify-self: flex-end;
  position: absolute;
  top: 0px;
  right: 25px;
  height: 100%;
  width: 100%;
  max-width: 250px;
  background-image: url(${p => p.image});
  background-repeat: no-repeat;
  background-size: contain;
`;

const ActionButton = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

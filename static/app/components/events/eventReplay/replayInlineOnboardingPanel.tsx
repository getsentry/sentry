import styled from '@emotion/styled';

import replayInlineOnboarding from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import HookOrDefault from 'sentry/components/hookOrDefault';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import theme from 'sentry/utils/theme';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';

type OnboardingCTAProps = {
  platform: PlatformKey;
  projectId: string;
};

const OnboardingCTAButton = HookOrDefault({
  hookName: 'component:replay-onboarding-cta-button',
  defaultComponent: null,
});

export default function ReplayInlineOnboardingPanel({
  platform,
  projectId,
}: OnboardingCTAProps) {
  const LOCAL_STORAGE_KEY = `${projectId}:issue-details-replay-onboarding-hide`;

  const {dismiss: snooze, isDismissed: isSnoozed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 7,
  });

  const {dismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 365,
  });

  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  const platformKey = platforms.find(p => p.id === platform) ?? otherPlatform;
  const platformName = platformKey === otherPlatform ? '' : platformKey.name;
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);
  const organization = useOrganization();

  if (isDismissed || isSnoozed) {
    return null;
  }

  return (
    <EventReplaySection>
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
            {!isScreenSmall && <OnboardingCTAButton />}
            <Button
              analyticsEventName="Clicked Replay Onboarding CTA Set Up Button in Issue Details"
              analyticsEventKey="issue_details.replay-onboarding-cta-set-up-button-clicked"
              analyticsParams={{platform}}
              onClick={activateSidebar}
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
                dismiss();
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
                snooze();
                trackAnalytics('issue-details.replay-cta-dismiss', {
                  organization,
                  type: 'snooze',
                });
              },
            },
          ]}
        />
      </BannerWrapper>
    </EventReplaySection>
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: bold;
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
  font-weight: 600;
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

import {useState} from 'react';
import styled from '@emotion/styled';

import replaysInlineOnboarding from 'sentry-images/spot/replay-onboarding-backend.svg';

import PageBanner from 'sentry/components/alerts/pageBanner';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import HookOrDefault from 'sentry/components/hookOrDefault';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconBroadcast} from 'sentry/icons/iconBroadcast';
import {t, tct} from 'sentry/locale';
import {PlatformKey} from 'sentry/types';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';

type OnboardingCTAProps = {
  platform: PlatformKey;
};

const OnboardingCTAButton = HookOrDefault({
  hookName: 'component:replay-onboarding-cta-button',
  defaultComponent: null,
});

export default function ReplayInlineOnboardingPanelBackend({
  platform,
}: OnboardingCTAProps) {
  const [isHidden, setIsHidden] = useState(false);
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  const platformName = platforms.find(p => p.id === platform) ?? otherPlatform;

  return (
    <EventReplaySection
      actions={
        <Button borderless onClick={() => setIsHidden(!isHidden)}>
          {isHidden ? t('Show Details') : t('Hide Details')}
        </Button>
      }
    >
      {isHidden ? null : (
        <PageBanner
          button={
            <ButtonBar gap={1}>
              <OnboardingCTAButton />
              <Button
                priority="primary"
                analyticsEventName="Clicked Replay Onboarding Backend CTA Button in Issue Details"
                analyticsEventKey="issue_details.replay-onboarding-backend-cta-button-clicked"
                analyticsParams={{button: 'Set Up Now'}}
                onClick={activateSidebar}
              >
                {t('Set Up Now')}
              </Button>
            </ButtonBar>
          }
          description={t('Watch the errors and latency issues your users face')}
          heading={tct('Set up your [platform] app now', {
            platform: <PurpleText>{platformName.name}</PurpleText>,
          })}
          icon={<IconBroadcast size="sm" color="purple300" />}
          image={replaysInlineOnboarding}
          title={<PurpleText>{t('What’s new')}</PurpleText>}
        />
      )}
    </EventReplaySection>
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: bold;
`;

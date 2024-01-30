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
import type {PlatformKey} from 'sentry/types';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';
import SectionToggleButton from 'sentry/views/issueDetails/sectionToggleButton';

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
  const [isExpanded, setIsExpanded] = useState(true);
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  const platformName = platforms.find(p => p.id === platform) ?? otherPlatform;
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);

  return (
    <EventReplaySection
      actions={
        <SectionToggleButton isExpanded={isExpanded} onExpandChange={setIsExpanded} />
      }
    >
      {isExpanded ? (
        <PageBanner
          button={
            <ButtonBar gap={1}>
              {!isScreenSmall && <OnboardingCTAButton />}
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
      ) : null}
    </EventReplaySection>
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: bold;
`;

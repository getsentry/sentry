import styled from '@emotion/styled';

import replaysInlineOnboarding from 'sentry-images/spot/replay-onboarding-backend.svg';

import PageBanner from 'sentry/components/alerts/pageBanner';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {IconBroadcast} from 'sentry/icons/iconBroadcast';
import {t} from 'sentry/locale';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';

const OnboardingCTAButton = HookOrDefault({
  hookName: 'component:replay-onboarding-cta-button',
  defaultComponent: null,
});

export default function ReplayInlineCTAPanel() {
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  return (
    <PageBanner
      button={
        <ButtonBar gap={1}>
          <OnboardingCTAButton />
          <Button
            priority="primary"
            analyticsEventName="Clicked Replay Onboarding CTA Button in User Feedback"
            analyticsEventKey="feedback.replay-onboarding-cta-button-clicked"
            onClick={activateSidebar}
          >
            {t('Set Up Now')}
          </Button>
        </ButtonBar>
      }
      description={t(
        "Don't fully understand the feedback message? Install Session Replay to see what the user was doing leading up to the feedback submission."
      )}
      heading={t('Set Up Session Replay')}
      icon={<IconBroadcast size="sm" color="purple300" />}
      image={replaysInlineOnboarding}
      title={<PurpleText>{t('Session Replay')}</PurpleText>}
    />
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: bold;
`;

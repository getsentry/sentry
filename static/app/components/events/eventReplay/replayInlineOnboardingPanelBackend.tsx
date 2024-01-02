import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import replaysInlineOnboarding from 'sentry-images/spot/replay-onboarding-backend.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import PageBanner from 'sentry/components/replays/pageBanner';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconBroadcast} from 'sentry/icons/iconBroadcast';
import {t, tct} from 'sentry/locale';
import {PlatformKey} from 'sentry/types';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';

type OnboardingCTAProps = {
  platform: PlatformKey;
};

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
          {t('Hide Details')}
        </Button>
      }
    >
      <Fragment>
        {isHidden ? null : (
          <PageBanner
            button={
              <ButtonBar gap={1}>
                <Button priority="default" onClick={() => {}}>
                  {t('View Sample')}
                </Button>
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
            heading={tct('Set up your [platform] app with Session Replay', {
              platform: <PurpleText>{platformName.name}</PurpleText>,
            })}
            icon={<IconBroadcast size="sm" color="purple300" />}
            image={replaysInlineOnboarding}
            title={<PurpleText>{t('What’s new')}</PurpleText>}
          />
        )}
      </Fragment>
    </EventReplaySection>
  );
}

const PurpleText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: bold;
`;

import {useState} from 'react';
import styled from '@emotion/styled';

import replaysInlineOnboarding from 'sentry-images/spot/replay-inline-onboarding.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import localStorage from 'sentry/utils/localStorage';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';

const LOCAL_STORAGE_KEY = 'replay-preview-onboarding-hide-until';
const SNOOZE_TIME = 1000 * 60 * 60 * 24 * 7; // 1 week
const DISMISS_TIME = 1000 * 60 * 60 * 24 * 365; // 1 year

function getHideUntilTime() {
  return Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0;
}

function setHideUntilTime(offset: number) {
  localStorage.setItem(LOCAL_STORAGE_KEY, String(Date.now() + offset));
}

function clearHideUntilTime() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export default function ReplayInlineOnboardingPanel() {
  const [isHidden, setIsHidden] = useState(() => {
    const hideUntilTime = getHideUntilTime();
    if (hideUntilTime && Date.now() < hideUntilTime) {
      return true;
    }
    clearHideUntilTime();
    return false;
  });
  const {activateSidebar} = useReplayOnboardingSidebarPanel();

  if (isHidden) {
    return null;
  }

  return (
    <EventReplaySection>
      <StyledOnboardingPanel>
        <div>
          <Heading>{t('Configure Session Replay')}</Heading>
          <Content>
            {t(
              'Playback your app to identify the root cause of errors and latency issues.'
            )}
          </Content>
          <ButtonList>
            <Button onClick={activateSidebar} priority="primary" size="sm">
              {t('Get Started')}
            </Button>
            <ButtonBar merged>
              <Button
                size="sm"
                onClick={() => {
                  setHideUntilTime(SNOOZE_TIME);
                  setIsHidden(true);
                }}
              >
                {t('Snooze')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setHideUntilTime(DISMISS_TIME);
                  setIsHidden(true);
                }}
              >
                {t('Dismiss')}
              </Button>
            </ButtonBar>
          </ButtonList>
        </div>
        <Illustration src={replaysInlineOnboarding} width={220} height={112} alt="" />
      </StyledOnboardingPanel>
    </EventReplaySection>
  );
}

const StyledOnboardingPanel = styled('div')`
  display: flex;
  flex-direction: column;
  max-width: 600px;
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  margin-bottom: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: row;
  }
`;

const Heading = styled('h3')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const Content = styled('p')`
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Illustration = styled('img')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;

const ButtonList = styled('div')`
  display: inline-flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0 ${space(1)};
`;

import styled from '@emotion/styled';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

import {NewMonitorButton} from './newMonitorButton';

export function CronsLandingPanel() {
  return (
    <OnboardingPanel image={<img src={onboardingImg} />}>
      <h3>{t('Let Sentry monitor your recurring jobs')}</h3>
      <p>
        {t(
          "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
        )}
      </p>
      <OnboardingActions gap={1}>
        <NewMonitorButton>{t('Set up first cron monitor')}</NewMonitorButton>
        <Button href="https://docs.sentry.io/product/crons" external>
          {t('Read docs')}
        </Button>
      </OnboardingActions>
    </OnboardingPanel>
  );
}

const OnboardingActions = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

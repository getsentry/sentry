import React from 'react';
import styled from '@emotion/styled';

import OnboardingPanel from 'app/components/onboardingPanel';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';

import emptyStateImg from '../../../images/spot/performance-empty-state.svg';

function Onboarding() {
  return (
    <OnboardingPanel image={<PerfImage src={emptyStateImg} />}>
      <h3>{t('Pinpoint problems')}</h3>
      <p>
        {t(
          'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
        )}
      </p>
      <ButtonList gap={1}>
        <Button
          priority="default"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/performance/"
        >
          {t('Learn More')}
        </Button>
        <Button
          priority="primary"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/getting-started/"
        >
          {t('Start Setup')}
        </Button>
      </ButtonList>
    </OnboardingPanel>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 50px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default Onboarding;

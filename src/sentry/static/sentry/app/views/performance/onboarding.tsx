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
          "You've got this souped up plan. Now what? Get your software set up. We've got transactions to track down."
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
          href="https://docs.sentry.io/performance-monitoring/setup/"
        >
          {t('Start Setup')}
        </Button>
      </ButtonList>
    </OnboardingPanel>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    user-select: none;
    position: absolute;
    width: 450px;
    top: 20%;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    top: 25%;
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    top: 20%;
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default Onboarding;

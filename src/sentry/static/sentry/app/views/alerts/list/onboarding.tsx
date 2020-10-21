import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import ButtonBar from 'app/components/buttonBar';
import OnboardingPanel from 'app/components/onboardingPanel';
import emptyStateImg from 'app/../images/spot/alerts-empty-state.svg';

type Props = {
  actions: React.ReactNode;
};

function Onboarding({actions}: Props) {
  return (
    <OnboardingPanel image={<AlertsImage src={emptyStateImg} />}>
      <h3>{t('More signal, less noise')}</h3>
      <p>
        {t(
          'Not every error is worth an email. Set your own rules for alerts you need, with information that helps.'
        )}
      </p>
      <ButtonList gap={1}>{actions}</ButtonList>
    </OnboardingPanel>
  );
}

const AlertsImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    user-select: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 220px;
    margin-top: auto;
    margin-bottom: auto;
    transform: translateX(-50%);
    left: 50%;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    transform: translateX(-60%);
    width: 280px;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    transform: translateX(-75%);
    width: 320px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default Onboarding;

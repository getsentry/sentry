import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/alerts-empty-state.svg';

import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

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
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    user-select: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 220px;
    margin-top: auto;
    margin-bottom: auto;
    transform: translateX(-40%);
    left: 50%;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    transform: translateX(-50%);
    width: 300px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-65%);
    width: 420px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default Onboarding;

import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/replays-empty-state.svg';

import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

interface Props {
  children?: React.ReactNode;
}

export default function ReplayOnboardingPanel(props: Props) {
  return (
    <OnboardingPanel image={<HeroImage src={emptyStateImg} />}>
      <h3>{t('Get to the root cause of errors faster.')}</h3>
      <p>
        {t(
          'See a video-like reproduction of your user sessions so you can see what happened before, during, and after an error or latency issue occurred.'
        )}
      </p>
      <ButtonList gap={1}>{props.children}</ButtonList>
    </OnboardingPanel>
  );
}

const HeroImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    transform: translateX(-55%);
    width: 300px;
    min-width: 300px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    transform: translateX(-60%);
    width: 380px;
    min-width: 380px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-65%);
    width: 420px;
    min-width: 420px;
  }
`;
const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

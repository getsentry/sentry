import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';

import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

interface ProfilingOnboardingPanelProps {
  children: React.ReactNode;
}

export function ProfilingOnboardingPanel(props: ProfilingOnboardingPanelProps) {
  return (
    <OnboardingPanel image={<HeroImage src={emptyStateImg} />}>
      <h3>{t('Function level insights')}</h3>
      <p>
        {t(
          'Discover slow-to-execute or resource intensive functions within your application'
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

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    transform: translateX(-30%);
    width: 380px;
    min-width: 380px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-30%);
    width: 420px;
    min-width: 420px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

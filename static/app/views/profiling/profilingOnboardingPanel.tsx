import {Fragment} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/profiling-empty-state.svg';

import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

interface ProfilingOnboardingPanelProps {
  children: React.ReactNode;
  content?: React.ReactNode;
}

export function ProfilingOnboardingPanel(props: ProfilingOnboardingPanelProps) {
  return (
    <OnboardingPanel image={<HeroImage src={emptyStateImg} />}>
      {props.content ? (
        props.content
      ) : (
        <Fragment>
          <h3>{t('Function level insights')}</h3>
          <p>
            {t(
              'Discover slow-to-execute or resource intensive functions within your application'
            )}
          </p>
        </Fragment>
      )}
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
    transform: translateX(-55%);
    width: 300px;
    min-width: 300px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    transform: translateX(-60%);
    width: 380px;
    min-width: 380px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    transform: translateX(-65%);
    width: 420px;
    min-width: 420px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

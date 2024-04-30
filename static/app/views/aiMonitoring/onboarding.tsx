import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

const docsSetupURL = 'https://docs.sentry.io/product/ai-monitoring/getting-started/';

export function AIMonitoringOnboarding() {
  return (
    <OnboardingPanel image={<PerfImage src={emptyStateImg} />}>
      <h3>{t('Understand your AI pipelines')}</h3>
      <p>
        {t(
          `Trying to productionize AI? Sentry's AI monitoring features help you understand the price, performance, and quality of your AI pipelines.`
        )}
      </p>
      <ButtonList gap={1}>
        <LinkButton priority="primary" href={docsSetupURL} external>
          {t('Start Setup')}
        </LinkButton>
      </ButtonList>
    </OnboardingPanel>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 75px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  margin-bottom: 16px;
`;

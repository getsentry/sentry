import styled from '@emotion/styled';

import onboardingServerSideSampling from 'sentry-images/spot/onboarding-server-side-sampling.svg';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

type Props = {
  hasAccess: boolean;
  onGetStarted: () => void;
  onReadDocs: () => void;
};

export function SamplingPromo({onGetStarted, hasAccess}: Props) {
  return (
    <OnboardingPanel image={<img src={onboardingServerSideSampling} />}>
      <h3>{t('Sample for relevancy')}</h3>
      <Paragraph>
        {t(
          'Create rules to sample transactions under specific conditions, keeping what you need and dropping what you don’t.'
        )}
      </Paragraph>
      <ButtonList gap={1}>
        <Button priority="primary" onClick={onGetStarted} disabled={!hasAccess}>
          {t('Start Setup')}
        </Button>
      </ButtonList>
    </OnboardingPanel>
  );
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

const Paragraph = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

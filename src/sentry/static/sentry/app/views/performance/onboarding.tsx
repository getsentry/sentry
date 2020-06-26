import React from 'react';
import styled from '@emotion/styled';

import OnboardingPanel from 'app/components/onboardingPanel';
import Button from 'app/components/button';
import space from 'app/styles/space';
import {t} from 'app/locale';

import emptyState from '../../../images/spot/performance-empty-state.svg';

function Onboarding() {
  return (
    <StyledOnboardingPanel>
      <h3>{t('Pinpoint problems')}</h3>
      <p>
        {t(
          "You've got this souped up plan. Now what? Get your software set up. We’ve got endpoints to track down."
        )}
      </p>
      <ButtonList>
        <Button
          priority="default"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/setup/"
        >
          {t('Take the tour')}
        </Button>
        <Button
          priority="primary"
          target="_blank"
          href="https://docs.sentry.io/performance-monitoring/setup/"
        >
          {t('Step 1: Install')}
        </Button>
      </ButtonList>
    </StyledOnboardingPanel>
  );
}

const StyledOnboardingPanel = styled(OnboardingPanel)`
  background: url(${emptyState}) no-repeat left center !important;
`;

const ButtonList = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  grid-gap: ${space(1)};
`;

export default Onboarding;

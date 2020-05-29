import React from 'react';

import OnboardingPanel from 'app/components/onboardingPanel';
import Button from 'app/components/button';
import {IconLightning} from 'app/icons';
import {t} from 'app/locale';

function Onboarding() {
  return (
    <OnboardingPanel image={<IconLightning size="200px" />}>
      <h3>{t('No transactions yet')}</h3>
      <p>
        {t(
          'View transactions sorted by slowest duration time, related issues, and number of users having a slow experience in one consolidated view. Trace those 10-second page loads to poor-performing API calls and its children.'
        )}
      </p>
      <Button
        priority="primary"
        target="_blank"
        href="https://docs.sentry.io/performance/distributed-tracing/#setting-up-tracing"
      >
        {t('Start Setup')}
      </Button>
    </OnboardingPanel>
  );
}

export default Onboarding;

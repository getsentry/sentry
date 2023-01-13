import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button} from 'sentry/components/button';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

const MonitorOnboarding = () => {
  return (
    <OnboardingPanel image={<img src={onboardingImg} />}>
      <h3>{t('Learn how to instrument your cron monitor')}</h3>
      <p>
        {t(
          "We'll tell you if this recurring job is running on schedule, failing, or succeeding."
        )}
      </p>
      <Button
        priority="primary"
        href="https://docs.sentry.io/product/crons/getting-started/#step-2-set-up-health-checks"
        external
      >
        {t('Start Setup')}
      </Button>
    </OnboardingPanel>
  );
};

export default MonitorOnboarding;

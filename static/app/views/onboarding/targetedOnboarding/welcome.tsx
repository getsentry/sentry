import * as React from 'react';
import styled from '@emotion/styled';
import {motion, MotionProps} from 'framer-motion';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import DemoSandboxButton from 'sentry/components/demoSandboxButton';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import WelcomeBackground from 'sentry/views/onboarding/components/welcomeBackground';

const fadeAway: MotionProps = {
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, filter: 'blur(0px)'},
    exit: {opacity: 0, filter: 'blur(1px)'},
  },
  transition: testableTransition({duration: 0.8}),
};

type Props = {
  organization: Organization;
};

function TargetedOnboardingWelcome({organization}: Props) {
  const source = 'targeted_onboarding';
  React.useEffect(() => {
    trackAdvancedAnalyticsEvent('growth.onboarding_start_onboarding', {
      organization,
      source,
    });
  });
  return (
    <Wrapper>
      <WelcomeBackground />
      <motion.h1 {...fadeAway}>{t('Welcome to Sentry')}</motion.h1>
      <motion.p {...fadeAway}>
        {t(
          'Find the errors and performance slowdowns that keep you up at night. In two steps.'
        )}
      </motion.p>
      <motion.p>
        <Button
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.onboarding_clicked_instrument_app', {
              organization,
              source,
            })
          }
          to={`/onboarding/${organization.slug}/select-platform/`}
        >
          {t('Instrument my application')}
        </Button>
      </motion.p>
      <motion.p>
        <Button
          onClick={() => {
            openInviteMembersModal({source});
          }}
        >
          {t('Setup my team and invite')}
        </Button>
      </motion.p>
      {!organization.features.includes('sandbox-kill-switch') && (
        <motion.p>
          <DemoSandboxButton scenario="oneIssue" {...{source}}>
            {t('Check out Sandbox')}
          </DemoSandboxButton>
        </motion.p>
      )}
    </Wrapper>
  );
}

const Wrapper = styled(motion.div)`
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 100px;

  h1 {
    font-size: 42px;
  }
`;

export default withOrganization(TargetedOnboardingWelcome);

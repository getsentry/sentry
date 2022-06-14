import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';

import {OnboardingState} from '../types';
import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

type Props = {
  genSkipOnboardingLink: () => React.ReactNode;
  integrations: string[];
  onComplete: () => void;
  organization: Organization;
};

export default function IntegrationsFooter({
  genSkipOnboardingLink,
  integrations,
  onComplete,
  organization,
}: Props) {
  const [clientState, setClientState] = usePersistedOnboardingState();

  const nextOnClick = () => {
    if (!clientState) {
      return;
    }
    const nextState: OnboardingState = {
      ...clientState,
      state: 'integrations_selected',
      url: 'setup-docs/',
      selectedIntegrations: integrations,
    };
    setClientState(nextState);

    trackAdvancedAnalyticsEvent('growth.onboarding_set_up_your_integrations', {
      integrations: integrations.join(','),
      integration_count: integrations.length,
      organization,
    });
    onComplete();
  };

  return (
    <GenericFooter>
      {genSkipOnboardingLink()}
      <ButtonWrapper>
        <Button
          priority="primary"
          data-test-id="integration-select-next"
          onClick={nextOnClick}
        >
          {t('Next')}
        </Button>
      </ButtonWrapper>
    </GenericFooter>
  );
}

const SelectionWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

SelectionWrapper.defaultProps = {
  transition: testableTransition({
    duration: 1.8,
  }),
};

const ButtonWrapper = styled(motion.div)`
  display: flex;
  height: 100%;
  align-items: center;
  margin-right: ${space(4)};
`;

ButtonWrapper.defaultProps = {
  transition: testableTransition({
    duration: 1.3,
  }),
};

import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

import {OnboardingState} from '../types';
import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

type Props = {
  genSkipOnboardingLink: () => React.ReactNode;
  integrations: string[];
  onComplete: () => void;
};

export default function IntegrationsFooter({
  genSkipOnboardingLink,
  integrations,
  onComplete,
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
    onComplete();
  };

  return (
    <GenericFooter>
      {genSkipOnboardingLink()}
      <ButtonWrapper>
        <Button
          priority="primary"
          disabled={integrations.length === 0}
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

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
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

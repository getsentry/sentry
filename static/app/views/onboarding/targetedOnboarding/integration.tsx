import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import IntegrationsFooter from './components/integrationFooter';
import IntegrationMultiSelect from './components/integrationSelect';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

export default function OnboardingIntegrationSelect(props: StepProps) {
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const addIntegration = (integration: string) => {
    if (!selectedIntegrations.includes(integration)) {
      setSelectedIntegrations([...selectedIntegrations, integration]);
    }
  };
  const removeIntegration = (integration: string) => {
    setSelectedIntegrations(selectedIntegrations.filter(p => p !== integration));
  };

  const [clientState] = usePersistedOnboardingState();
  useEffect(() => {
    if (clientState) {
      setSelectedIntegrations(clientState.selectedIntegrations);
    }
  }, [clientState]);

  return (
    <Wrapper>
      <StepHeading step={props.stepIndex}>
        {t('Select all the tools that help you work')}
      </StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {tct(
            `Here is just a small selection of the integrations at Sentry. [link: See All Integrations]`,
            {link: <ExternalLink href="https://docs.sentry.io/platforms/" />}
          )}
        </p>
        <IntegrationMultiSelect
          selectedIntegrations={selectedIntegrations}
          selectIntegration={addIntegration}
          removeIntegration={removeIntegration}
        />
      </motion.div>
      <IntegrationsFooter
        genSkipOnboardingLink={props.genSkipOnboardingLink}
        integrations={selectedIntegrations}
        onComplete={props.onComplete}
        organization={props.organization}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
`;

import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import PlatformPicker from 'sentry/components/platformPicker';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import CreateProjectsFooter from './components/createProjectsFooter';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

export function PlatformSelection(props: StepProps) {
  const organization = useOrganization();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | undefined>(
    undefined
  );

  const [clientState, _setClientState] = usePersistedOnboardingState();

  const disabledPlatforms = Object.keys(clientState?.platformToProjectIdMap ?? {}).reduce(
    (acc, key) => {
      if (!acc[key]) {
        acc[key] = t('Project already created');
      }
      return acc;
    },
    {}
  );

  useEffect(() => {
    if (!clientState) {
      return;
    }

    const selectedprojectCreated = disabledPlatforms[clientState.selectedPlatforms[0]];

    if (selectedPlatform === undefined && !selectedprojectCreated) {
      setSelectedPlatform(clientState.selectedPlatforms[0]);
    }
  }, [clientState, disabledPlatforms, selectedPlatform]);

  return (
    <Wrapper>
      <StepHeading step={props.stepIndex}>
        {t('Select the platform you want to monitor')}
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
          {t(
            // TODO(Priscila): Shall we create a doc for this onboarding and link it here too?
            'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from.'
          )}
        </p>
        <PlatformPicker
          noAutoFilter
          source="targeted-onboarding"
          platform={selectedPlatform}
          setPlatform={platformKey => {
            setSelectedPlatform(platformKey ?? undefined);
          }}
          disabledPlatforms={disabledPlatforms}
          organization={organization}
        />
      </motion.div>
      <CreateProjectsFooter
        {...props}
        organization={organization}
        clearPlatforms={() => setSelectedPlatform(undefined)}
        platforms={selectedPlatform ? [selectedPlatform] : []}
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

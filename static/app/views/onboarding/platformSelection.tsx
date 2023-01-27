import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import PlatformPicker from 'sentry/components/platformPicker';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import CreateProjectsFooter from './components/createProjectsFooter';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

export function PlatformSelection(props: StepProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | undefined>(
    undefined
  );

  const [clientState] = usePersistedOnboardingState();
  useEffect(() => {
    if (clientState) {
      setSelectedPlatform(clientState.selectedPlatforms[0]);
    }
  }, [clientState]);

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
          organization={props.organization}
        />
      </motion.div>
      <CreateProjectsFooter
        {...props}
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

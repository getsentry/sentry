import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import PlatformPicker from 'sentry/components/platformPicker';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import {CreateProjectsFooter} from './components/createProjectsFooter';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

export function PlatformSelection(props: StepProps) {
  const organization = useOrganization();
  const [clientState, setClientState] = usePersistedOnboardingState();

  const selectedPlatform = clientState?.selectedPlatforms?.[0]
    ? platforms.find(platform => platform.id === clientState?.selectedPlatforms?.[0].key)
      ? clientState?.selectedPlatforms?.[0]
      : undefined
    : undefined;

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
            'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from.'
          )}
        </p>
        <PlatformPicker
          noAutoFilter
          source="targeted-onboarding"
          platform={clientState?.selectedPlatforms?.[0]?.key}
          defaultCategory={clientState?.selectedPlatforms?.[0]?.category}
          setPlatform={platform => {
            if (clientState) {
              setClientState({
                ...clientState,
                selectedPlatforms: platform ? [platform] : [],
              });
            }
          }}
          organization={organization}
        />
      </motion.div>
      <CreateProjectsFooter
        {...props}
        organization={organization}
        clearPlatforms={() => {
          if (clientState) {
            setClientState({
              ...clientState,
              selectedPlatforms: [],
            });
          }
        }}
        selectedPlatforms={selectedPlatform ? [selectedPlatform] : []}
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

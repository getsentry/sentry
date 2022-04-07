import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import ExternalLink from 'sentry/components/links/externalLink';
import MultiPlatformPicker from 'sentry/components/multiPlatformPicker';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import CreateProjectsFooter from './components/createProjectsFooter';
import {ClientState, fetchClientState, StepProps} from './types';

function OnboardingPlatform(props: StepProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const addPlatform = (platform: PlatformKey) => {
    setSelectedPlatforms([...selectedPlatforms, platform]);
  };
  const removePlatform = (platform: PlatformKey) => {
    setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
  };

  const api = useApi();
  useEffect(() => {
    fetchClientState(api, props.organization.slug).then((lastState: ClientState) => {
      setSelectedPlatforms(lastState.selectedPlatforms);
    });
  }, []);

  const clearPlatforms = () => setSelectedPlatforms([]);
  return (
    <Wrapper>
      <StepHeading step={props.stepIndex}>
        {t('Select all your projects platform')}
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
            `Variety is the spice of application monitoring. Sentry SDKs integrate
           with most languages and platforms your developer heart desires.
           [link:View the full list].`,
            {link: <ExternalLink href="https://docs.sentry.io/platforms/" />}
          )}
        </p>
        <MultiPlatformPicker
          noAutoFilter
          source="targeted-onboarding"
          {...props}
          removePlatform={removePlatform}
          addPlatform={addPlatform}
          platforms={selectedPlatforms}
        />
      </motion.div>
      <CreateProjectsFooter
        {...props}
        clearPlatforms={clearPlatforms}
        platforms={selectedPlatforms}
      />
    </Wrapper>
  );
}

export default OnboardingPlatform;

const Wrapper = styled('div')`
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
`;

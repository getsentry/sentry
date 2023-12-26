import {useContext} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import PlatformPicker from 'sentry/components/platformPicker';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import {CreateProjectsFooter} from './components/createProjectsFooter';
import {StepProps} from './types';

export function PlatformSelection(props: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);

  const selectedPlatform = onboardingContext.data.selectedSDK
    ? platforms.find(platform => platform.id === onboardingContext.data.selectedSDK?.key)
      ? onboardingContext.data.selectedSDK
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
          platform={onboardingContext.data.selectedSDK?.key}
          defaultCategory={onboardingContext.data.selectedSDK?.category}
          setPlatform={platform => {
            // If we dont use nonnullable here, TS correctly complains that we
            // are passing undefined keys as selectedSDK, however that was already the case
            // in the previous implementation, it just didn't complain as omit is not type safe
            const {id: _, ...platformWithoutId} =
              platform ?? ({} as NonNullable<typeof platform>);

            onboardingContext.setData({
              ...onboardingContext.data,
              selectedSDK: platform
                ? {...platformWithoutId, key: platform.id}
                : undefined,
            });
          }}
          organization={organization}
        />
      </motion.div>
      <CreateProjectsFooter
        {...props}
        organization={organization}
        clearPlatform={() => {
          onboardingContext.setData({...onboardingContext.data, selectedSDK: undefined});
        }}
        selectedPlatform={selectedPlatform}
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

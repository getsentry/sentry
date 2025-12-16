import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import omit from 'lodash/omit';

import PlatformPicker from 'sentry/components/platformPicker';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';
import {useConfigureSdk} from 'sentry/views/onboarding/useConfigureSdk';

import type {StepProps} from './types';

export function PlatformSelection(props: StepProps) {
  const organization = useOrganization();

  const {configureSdk, isLoadingData} = useConfigureSdk({
    onComplete: props.onComplete,
  });

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
          loading={isLoadingData}
          noAutoFilter
          visibleSelection={false}
          source="targeted-onboarding"
          setPlatform={platform => {
            const selectedPlatform = platform
              ? {...omit(platform, 'id'), key: platform.id}
              : undefined;

            configureSdk(selectedPlatform);
          }}
          organization={organization}
        />
      </motion.div>
      <GenericFooter>{props.genSkipOnboardingLink()}</GenericFooter>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  max-width: ${p => p.theme.breakpoints.md};
  margin-left: auto;
  margin-right: auto;
  width: 100%;
`;

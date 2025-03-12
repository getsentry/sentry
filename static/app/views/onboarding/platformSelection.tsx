import {useContext} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import omit from 'lodash/omit';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import PlatformPicker from 'sentry/components/platformPicker';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';
import {useConfigureSdk} from 'sentry/views/onboarding/useConfigureSdk';

import {CreateProjectsFooter} from './components/createProjectsFooter';
import type {StepProps} from './types';

export function hasDocsOnPlatformClickEnabled(organization: Organization) {
  return organization.features.includes(
    'onboarding-load-docs-on-platform-click-and-silent-delete-on-back'
  );
}

export function PlatformSelection(props: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);

  const selectedPlatform = onboardingContext.data.selectedSDK
    ? platforms.find(platform => platform.id === onboardingContext.data.selectedSDK?.key)
      ? onboardingContext.data.selectedSDK
      : undefined
    : undefined;

  const {configureSdk} = useConfigureSdk({
    onComplete: props.onComplete,
  });

  const docsOnPlatformClickEnabled = hasDocsOnPlatformClickEnabled(organization);

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
            const selectedSDK = platform
              ? {...omit(platform, 'id'), key: platform.id}
              : undefined;

            if (docsOnPlatformClickEnabled) {
              configureSdk(selectedSDK);
            } else {
              onboardingContext.setData({
                ...onboardingContext.data,
                selectedSDK,
              });
            }
          }}
          organization={organization}
        />
      </motion.div>
      {docsOnPlatformClickEnabled ? (
        <GenericFooter>{props.genSkipOnboardingLink()}</GenericFooter>
      ) : (
        <CreateProjectsFooter
          {...props}
          clearPlatform={() => {
            onboardingContext.setData({
              ...onboardingContext.data,
              selectedSDK: undefined,
            });
          }}
          organization={organization}
          selectedPlatform={selectedPlatform}
        />
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
`;

import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import ExternalLink from 'sentry/components/links/externalLink';
import MultiPlatformPicker from 'sentry/components/multiPlatformPicker';
import {t, tct} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import CreateProjectsFooter from './components/createProjectsFooter';
import {StepProps} from './types';

function OnboardingPlatform(props: StepProps) {
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
        <MultiPlatformPicker noAutoFilter source="targeted-onboarding" {...props} />
        <CreateProjectsFooter {...props} />
      </motion.div>
    </Wrapper>
  );
}

export default OnboardingPlatform;

const Wrapper = styled('div')`
  width: 850px;
`;

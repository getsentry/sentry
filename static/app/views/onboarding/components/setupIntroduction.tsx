import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import type {PlatformKey} from 'sentry/types/platform';
import {useExperiment} from 'sentry/utils/useExperiment';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {OnboardingStepHeading} from './onboardingStepHeading';

type Props = {
  platform: PlatformKey;
  stepHeaderText: string;
};
export function SetupIntroduction({stepHeaderText, platform}: Props) {
  const {inExperiment: hasScmOnboarding} = useExperiment({
    feature: 'onboarding-scm-experiment',
    reportExposure: false,
  });

  return (
    <TitleContainer>
      <OnboardingStepHeading step={hasScmOnboarding ? undefined : 2}>
        {stepHeaderText}
      </OnboardingStepHeading>
      <IconWrapper {...ONBOARDING_ENTER}>
        <PlatformIcon size={48} format="lg" platform={platform} />
      </IconWrapper>
    </TitleContainer>
  );
}

const TitleContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};

  ${OnboardingStepHeading} {
    margin-bottom: 0;
    min-width: 0;
  }
`;

const IconWrapper = styled(motion.div)`
  margin-left: auto;
  flex-shrink: 0;
`;

import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import type {PlatformKey} from 'sentry/types/project';
import {useExperiment} from 'sentry/utils/useExperiment';

import {StepHeading} from './stepHeading';

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
      <StepHeading step={hasScmOnboarding ? undefined : 2}>{stepHeaderText}</StepHeading>
      <IconWrapper
        variants={{
          initial: {opacity: 0, x: 20},
          animate: {opacity: 1, x: 0},
          exit: {opacity: 0},
        }}
      >
        <PlatformIcon size={48} format="lg" platform={platform} />
      </IconWrapper>
    </TitleContainer>
  );
}

const TitleContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};

  ${StepHeading} {
    margin-bottom: 0;
    min-width: 0;
  }
`;

const IconWrapper = styled(motion.div)`
  margin-left: auto;
  flex-shrink: 0;
`;

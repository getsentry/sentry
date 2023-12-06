import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types';

import StepHeading from './stepHeading';

type Props = {
  platform: PlatformKey;
  stepHeaderText: string;
};
export default function SetupIntroduction({stepHeaderText, platform}: Props) {
  return (
    <TitleContainer>
      <StepHeading step={2}>{stepHeaderText}</StepHeading>
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
  gap: ${space(2)};

  ${StepHeading} {
    margin-bottom: 0;
    min-width: 0;
  }
`;

const IconWrapper = styled(motion.div)`
  margin-left: auto;
  flex-shrink: 0;
`;

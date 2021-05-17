import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {PlatformKey} from 'app/data/platformCategories';
import space from 'app/styles/space';

import StepHeading from './stepHeading';

type Props = {
  stepHeaderText: string;
  platform: PlatformKey;
};
export default function SetupIntroduction({stepHeaderText, platform}: Props) {
  return (
    <TitleContainer>
      <StepHeading step={2}>{stepHeaderText}</StepHeading>
      <motion.div
        variants={{
          initial: {opacity: 0, x: 20},
          animate: {opacity: 1, x: 0},
          exit: {opacity: 0},
        }}
      >
        <PlatformIcon size={48} format="lg" platform={platform} />
      </motion.div>
    </TitleContainer>
  );
}

const TitleContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(2)};
  align-items: center;
  justify-items: end;

  ${StepHeading} {
    margin-bottom: 0;
  }
`;

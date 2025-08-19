import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import {useLottie} from 'lottie-react';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';

interface SeeryCharacterProps {
  animationData: any;
  size?: number;
}

function SeeryCharacter({animationData, size}: SeeryCharacterProps) {
  const {visible} = useGlobalModal();
  const {View} = useLottie({
    animationData,
    autoplay: true,
    loop: true,
  });

  return createPortal(
    <AnimatePresence>
      {visible && (
        <CharacterContainer
          size={size}
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.2}}
        >
          <AnimationContainer size={size}>{View}</AnimationContainer>
        </CharacterContainer>
      )}
    </AnimatePresence>,
    document.body
  );
}

const CharacterContainer = styled(motion.div)<{size?: number}>`
  position: fixed;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${p => p.theme.zIndex.modal + 1};
  ${p => p.size && `width: ${p.size}px; height: ${p.size}px;`}
`;

const AnimationContainer = styled('div')<{size?: number}>`
  width: 100%;
  height: 100%;

  svg {
    width: 100% !important;
    height: 100% !important;
    ${p =>
      p.size && `max-width: ${p.size}px !important; max-height: ${p.size}px !important;`}
  }
`;

export default SeeryCharacter;
export type {SeeryCharacterProps};

import {useEffect, useImperativeHandle} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import {useLottie} from 'lottie-react';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';

interface SeeryCharacterProps {
  animationData: any;
  ref?: React.Ref<SeeryCharacterRef>;
  size?: number;
}

interface SeeryCharacterRef {
  triggerImpatient: () => void;
}

function SeeryCharacter({animationData, size, ref}: SeeryCharacterProps) {
  const {visible} = useGlobalModal();
  const {View, animationItem} = useLottie({
    animationData,
    autoplay: true,
    loop: true,
  });

  // Set up the idle loop when component mounts
  useEffect(() => {
    if (animationItem) {
      // Start with idle animation (frames 0-19, which are 1-20 in 1-indexed)
      animationItem.goToAndStop(0, true);
      animationItem.playSegments(
        [
          [0, 19],
          [19, 0],
        ],
        true
      );
      animationItem.loop = true;
    }
  }, [animationItem]);

  useImperativeHandle(
    ref,
    () => ({
      triggerImpatient: () => {
        if (animationItem) {
          // Turn off looping temporarily
          animationItem.loop = false;

          // Play impatient animation once (frames 19-32, which are 20-33 in 1-indexed)
          animationItem.playSegments(
            [
              [19, 32],
              [32, 19],
            ],
            true
          );

          // Set up listener to go back to idle after impatient completes
          const onComplete = () => {
            animationItem.removeEventListener('complete', onComplete);
            // Go back to idle loop
            animationItem.loop = true;
            animationItem.playSegments(
              [
                [0, 19],
                [19, 0],
              ],
              true
            );
          };

          animationItem.addEventListener('complete', onComplete);
        }
      },
    }),
    [animationItem]
  );

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
export type {SeeryCharacterRef};

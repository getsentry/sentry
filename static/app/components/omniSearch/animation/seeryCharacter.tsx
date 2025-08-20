import {useCallback, useEffect, useImperativeHandle} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import computerSvg from 'getsentry-images/omni_search/computer.svg';
import {useLottie} from 'lottie-react';

import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';

interface SeeryCharacterProps {
  animationData: any;
  ref?: React.Ref<SeeryCharacterRef>;
  size?: number;
}

interface SeeryCharacterRef {
  triggerBarrelRoll: () => void;
  triggerCelebrate: () => void;
  triggerError: () => void;
  triggerImpatient: () => void;
  triggerSearchDone: () => void;
  triggerWatching: () => void;
}

function playIdleLoop(animationItem: any) {
  if (!animationItem) return;
  animationItem.loop = true;
  animationItem.goToAndStop(13, true);
  animationItem.playSegments([[13, 33]], true);
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
      playIdleLoop(animationItem);
    }
  }, [animationItem]);

  const playSegmentAndReturnToIdle = useCallback(
    (start: number, end: number) => {
      if (!animationItem) return;
      animationItem.loop = false;
      animationItem.goToAndStop(start, true);
      animationItem.playSegments([[start, end]], true);

      const onComplete = () => {
        animationItem.removeEventListener('complete', onComplete);
        playIdleLoop(animationItem);
      };

      animationItem.addEventListener('complete', onComplete);
    },
    [animationItem]
  );

  const triggerBarrelRoll = useCallback(() => {
    const container = document.querySelector('[data-seery-container]') as HTMLElement;
    if (container) {
      container.style.animation = 'seery-barrel-roll 1s ease-in-out';
      setTimeout(() => {
        container.style.animation = '';
      }, 1000);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      triggerBarrelRoll,
      triggerImpatient: () => {
        playSegmentAndReturnToIdle(33, 49);
      },
      triggerError: () => {
        playSegmentAndReturnToIdle(48, 63);
      },
      triggerWatching: () => {
        playSegmentAndReturnToIdle(63, 83);
      },
      triggerCelebrate: () => {
        playSegmentAndReturnToIdle(83, 100);
      },
      triggerSearchDone: () => {
        playSegmentAndReturnToIdle(100, 115);
      },
    }),
    [playSegmentAndReturnToIdle, triggerBarrelRoll]
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
          data-seery-container
        >
          <BackgroundImage src={computerSvg} alt="" />
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

  @keyframes seery-barrel-roll {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const BackgroundImage = styled('img')`
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1;
`;

const AnimationContainer = styled('div')<{size?: number}>`
  position: absolute;
  top: 20%;
  left: 33%;
  width: 35%;
  height: 35%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }
`;

export default SeeryCharacter;
export type {SeeryCharacterRef};

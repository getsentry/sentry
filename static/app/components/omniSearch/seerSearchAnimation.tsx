import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import brainJuice1 from 'sentry-images/omni_search/brain-juice-1.png';
import grainyBackground from 'sentry-images/omni_search/purple-grain-bg.png';

import {SEER_ANIMATION_EXIT_DURATION} from 'sentry/components/omniSearch/constants';
import {useOmniSearchStore} from 'sentry/components/omniSearch/context';
import getModalPortal from 'sentry/utils/getModalPortal';

function Overlay() {
  const {isSearchingSeer} = useOmniSearchStore();

  return createPortal(
    <AnimatePresence>
      {isSearchingSeer && (
        <OverlayContainer
          initial={{opacity: 0}}
          animate={{opacity: 0.5}}
          exit={{opacity: 0, transition: {duration: SEER_ANIMATION_EXIT_DURATION / 1000}}}
          transition={{duration: 2}}
        >
          <GrainyOverlay
            src={grainyBackground}
            alt="Seer Search Animation"
            animate={{
              scale: [1.6, 1.1],
            }}
            transition={{
              duration: 10,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'mirror',
            }}
          />
        </OverlayContainer>
      )}
    </AnimatePresence>,
    getModalPortal()
  );
}

function ModalBrainJuice() {
  const {isSearchingSeer} = useOmniSearchStore();
  const el = document.getElementById('omni-search-modal');

  if (!el) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isSearchingSeer && (
        <ModalBrainJuiceImage1
          src={brainJuice1}
          initial={{y: 0}}
          animate={{y: 50}}
          exit={{y: 0, transition: {duration: SEER_ANIMATION_EXIT_DURATION / 1000}}}
          transition={{duration: 10, type: 'spring', bounce: 0.5}}
        />
      )}
      {isSearchingSeer && (
        <ModalBrainJuiceImage2
          src={brainJuice1}
          initial={{y: 0}}
          animate={{y: 50}}
          exit={{y: 0, transition: {duration: SEER_ANIMATION_EXIT_DURATION / 1000}}}
          transition={{duration: 8, type: 'spring', bounce: 0.5, delay: 2}}
        />
      )}
    </AnimatePresence>,
    el
  );
}

export function SeerSearchAnimation() {
  return (
    <Fragment>
      <Overlay />
      <ModalBrainJuice />
    </Fragment>
  );
}

const OverlayContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: ${p => p.theme.zIndex.modal - 1};
`;

const GrainyOverlay = styled(motion.img)`
  width: 100%;
  height: 100%;
`;

const ModalBrainJuiceImage1 = styled(motion.img)`
  position: absolute;
  bottom: 0;
  right: 10px;
  width: 100px;
  z-index: -1;
`;

const ModalBrainJuiceImage2 = styled(motion.img)`
  position: absolute;
  bottom: 0;
  left: 80px;
  width: 120px;
  z-index: -1;
`;

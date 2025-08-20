import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

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
              duration: 6,
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

export function SeerSearchAnimation() {
  return <Overlay />;
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

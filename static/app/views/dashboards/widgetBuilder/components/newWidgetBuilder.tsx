import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import useKeyPress from 'sentry/utils/useKeyPress';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';

type DevWidgetBuilderProps = {
  isOpen: boolean;
  onClose: () => void;
};

function DevWidgetBuilder({isOpen, onClose}: DevWidgetBuilderProps) {
  const escapeKeyPressed = useKeyPress('Escape');

  // TODO(nikki): be able to handle clicking outside widget to close

  useEffect(() => {
    if (escapeKeyPressed) {
      if (isOpen) {
        onClose?.();
      }
    }
  }, [escapeKeyPressed, isOpen, onClose]);

  return (
    <Fragment>
      {isOpen && <Backdrop style={{opacity: 0.5, pointerEvents: 'auto'}} />}
      <AnimatePresence>
        {isOpen && (
          <WidgetBuilderContainer>
            <WidgetBuilderSlideout isOpen={isOpen} onClose={onClose} />
            <SampleWidgetCard
              initial={{opacity: 0, x: '50%', y: 0}}
              animate={{opacity: 1, x: 0, y: 0}}
              exit={{opacity: 0, x: '50%', y: 0}}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 50,
              }}
            >
              {'TEST WIDGET'}
            </SampleWidgetCard>
          </WidgetBuilderContainer>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

export default DevWidgetBuilder;

const fullPageCss = css`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Backdrop = styled('div')`
  ${fullPageCss};
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  background: ${p => p.theme.black};
  will-change: opacity;
  transition: opacity 200ms;
  pointer-events: none;
  opacity: 0;
`;

// TODO: Make this centered
const SampleWidgetCard = styled(motion.div)`
  width: 400px;
  height: 300px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  align-content: center;
  text-align: center;
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  position: relative;
  margin-right: 2%;
`;

const WidgetBuilderContainer = styled('div')`
  ${fullPageCss}
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

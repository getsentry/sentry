import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {space} from 'sentry/styles/space';

import MinimizedStrip from './minimizedStrip';
import type {Block, PanelSize} from './types';

interface PanelContainersProps {
  blocks: Block[];
  children: React.ReactNode;
  isOpen: boolean;
  isPolling: boolean;
  onClear: () => void;
  onMaxSize: () => void;
  onMedSize: () => void;
  onMinSize: () => void;
  onSubmit: (message: string) => void;
  panelSize: PanelSize;
}

function PanelContainers({
  isOpen,
  panelSize,
  children,
  blocks,
  onSubmit,
  isPolling,
  onMaxSize,
  onMedSize,
  onMinSize,
  onClear,
}: PanelContainersProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          {panelSize === 'min' ? (
            <MinimizedStrip
              key="minimized"
              blocks={blocks}
              onSubmit={onSubmit}
              isPolling={isPolling}
              onMaxSize={onMaxSize}
              onMedSize={onMedSize}
              onMinSize={onMinSize}
              onClear={onClear}
            />
          ) : (
            <Fragment>
              {panelSize === 'max' && (
                <Backdrop
                  key="backdrop"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.1}}
                />
              )}
              <PanelContainer
                panelSize={panelSize}
                initial={{
                  opacity: 0,
                  y: 50,
                  scale: 0.1,
                  transformOrigin: 'bottom center',
                }}
                animate={{opacity: 1, y: 0, scale: 1, transformOrigin: 'bottom center'}}
                exit={{opacity: 0, y: 50, scale: 0.1, transformOrigin: 'bottom center'}}
                transition={{duration: 0.1, ease: 'easeOut'}}
              >
                <PanelContent data-seer-explorer-root="">{children}</PanelContent>
              </PanelContainer>
            </Fragment>
          )}
        </Fragment>
      )}
    </AnimatePresence>
  );
}

export default PanelContainers;

const Backdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: auto;
`;

const PanelContainer = styled(motion.div)<{panelSize: 'max' | 'med'}>`
  position: fixed;
  bottom: ${space(2)};
  left: 50%;
  z-index: 10000;
  pointer-events: auto;

  ${p =>
    p.panelSize === 'max'
      ? `
      width: calc(100vw - ${space(4)});
      height: calc(100vh - ${space(4)});
      margin-left: calc(-50vw + ${space(2)});
    `
      : `
      width: 50vw;
      height: 50vh;
      margin-left: -25vw;
    `}

  transition: all 0.2s ease-in-out;
`;

const PanelContent = styled('div')`
  width: 100%;
  height: 100%;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const BlocksContainer = styled('div')`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

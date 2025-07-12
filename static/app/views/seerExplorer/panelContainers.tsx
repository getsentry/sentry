import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {IconSeer} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import type {PanelSize} from './types';

interface PanelContainersProps {
  children: React.ReactNode;
  isOpen: boolean;
  onMinPanelClick: () => void;
  panelSize: PanelSize;
}

function PanelContainers({
  isOpen,
  panelSize,
  onMinPanelClick,
  children,
}: PanelContainersProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          {panelSize === 'min' ? (
            <MinimizedPanel
              key="minimized"
              initial={{opacity: 0, scale: 0.1, transformOrigin: 'bottom center'}}
              animate={{opacity: 1, scale: 1, transformOrigin: 'bottom center'}}
              exit={{opacity: 0, scale: 0.1, transformOrigin: 'bottom center'}}
              transition={{duration: 0.2, ease: 'easeInOut'}}
              onClick={onMinPanelClick}
            >
              <IconSeer size="lg" variant="waiting" />
            </MinimizedPanel>
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
                <PanelContent>{children}</PanelContent>
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

const MinimizedPanel = styled(motion.div)`
  position: fixed;
  bottom: ${space(2)};
  left: 50%;
  margin-left: -30px;
  width: 60px;
  height: 60px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10000;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
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

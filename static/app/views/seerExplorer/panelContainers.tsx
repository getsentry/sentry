import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PanelSize} from 'sentry/views/seerExplorer/types';

interface PanelContainersProps {
  children: React.ReactNode;
  isMinimized: boolean;
  isOpen: boolean;
  panelSize: PanelSize;
  onUnminimize?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

function PanelContainers({
  isOpen,
  isMinimized,
  panelSize,
  children,
  onUnminimize,
  ref,
}: PanelContainersProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          {panelSize === 'max' && (
            <Backdrop
              key="backdrop"
              isMinimized={isMinimized}
              initial={{opacity: 0}}
              animate={{opacity: isMinimized ? 0 : 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.1}}
            />
          )}
          <PanelContainer
            panelSize={panelSize}
            isMinimized={isMinimized}
            initial={{
              opacity: 0,
              y: 50,
              scale: 0.1,
              transformOrigin: 'bottom center',
            }}
            animate={{
              opacity: 1,
              y: isMinimized ? 'calc(100% - 60px)' : 0,
              scale: 1,
              transformOrigin: 'bottom center',
            }}
            exit={{opacity: 0, y: 50, scale: 0.1, transformOrigin: 'bottom center'}}
            transition={{duration: 0.1, ease: 'easeInOut'}}
          >
            <PanelContent ref={ref} data-seer-explorer-root="">
              {children}
              {isMinimized && (
                <MinimizedOverlay
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.2}}
                  onClick={onUnminimize}
                >
                  <Flex direction="column" align="center" gap="lg">
                    <IconSeer variant="waiting" size="lg" color="purple400" />
                    <Text variant="muted">
                      Press Tab ⇥ or click to continue with Seer
                    </Text>
                  </Flex>
                </MinimizedOverlay>
              )}
            </PanelContent>
          </PanelContainer>
        </Fragment>
      )}
    </AnimatePresence>
  );
}

export default PanelContainers;

const Backdrop = styled(motion.div)<{isMinimized: boolean}>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: ${p => (p.isMinimized ? 'none' : 'auto')};
`;

const PanelContainer = styled(motion.div)<{
  isMinimized: boolean;
  panelSize: 'max' | 'med';
}>`
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

const MinimizedOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${p => p.theme.background};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: ${p => p.theme.space.lg};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  z-index: 1;
  cursor: pointer;

  /* Purple tint */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${p => p.theme.purple200};
    border-radius: inherit;
    z-index: -1;
    pointer-events: none;
  }
`;

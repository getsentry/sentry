import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';
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
              transition={{duration: 0.12}}
            />
          )}
          <PanelContainer
            panelSize={panelSize}
            isMinimized={isMinimized}
            initial={{
              opacity: 0,
              y: 50,
              scaleY: 0.1,
              transformOrigin: 'bottom center',
            }}
            animate={{
              opacity: 1,
              y: isMinimized ? 'calc(100% - 60px)' : 0,
              scaleY: 1,
              transformOrigin: 'bottom center',
            }}
            exit={{opacity: 0, y: 50, scaleY: 0.1, transformOrigin: 'bottom center'}}
            transition={{duration: 0.12, ease: 'easeInOut'}}
          >
            <PanelContent ref={ref} data-seer-explorer-root="">
              {children}
              {isMinimized && (
                <MinimizedOverlay
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{duration: 0.12}}
                  onClick={onUnminimize}
                >
                  <Flex direction="column" align="center" gap="md">
                    <IconSeer animation="waiting" size="lg" />
                    <Text>Press Tab ⇥ or click to continue with Seer</Text>
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
  bottom: ${p => p.theme.space.md};
  left: 50%;
  z-index: 10000;
  pointer-events: auto;

  ${p =>
    p.panelSize === 'max'
      ? `
      width: calc(100vw - ${p.theme.space.xl});
      height: calc(100vh - ${p.theme.space.xl});
      margin-left: calc(-50vw + ${p.theme.space.md});
    `
      : `
      width: 50vw;
      height: 60vh;
      margin-left: -25vw;
    `}

  transition: all 0.12s ease-in-out;
`;

const PanelContent = styled('div')`
  width: 100%;
  height: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export function BlocksContainer(props: StackProps<'div'>) {
  return <Stack flex="1" overflowY="auto" {...props} />;
}

const MinimizedOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: ${p => p.theme.space.lg};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
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
    background: ${p => p.theme.colors.blue200};
    border-radius: inherit;
    z-index: -1;
    pointer-events: none;
  }
`;

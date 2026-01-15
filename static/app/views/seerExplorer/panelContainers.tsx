import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Block, PanelSize} from 'sentry/views/seerExplorer/types';
import {getToolsStringFromBlock} from 'sentry/views/seerExplorer/utils';

interface PanelContainersProps {
  children: React.ReactNode;
  isMinimized: boolean;
  isOpen: boolean;
  panelSize: PanelSize;
  blocks?: Block[];
  isPolling?: boolean;
  onUnminimize?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

function getStatusText(blocks: Block[]): string {
  // Find the most recent usable block for status display
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (!block || block.message?.role === 'user') {
      break;
    }

    // Check for message content (skip "thinking" blocks)
    const content = block.message?.content?.trim();
    if (content && content.toLowerCase() !== 'thinking' && content !== 'thinking...') {
      return content;
    }

    // Check for tool calls
    const toolStrings = getToolsStringFromBlock(block);
    if (toolStrings.length > 0 && !block.loading) {
      return toolStrings[toolStrings.length - 1] || t('Analyzing...');
    }
  }

  return t('Analyzing...');
}

function PanelContainers({
  isOpen,
  isMinimized,
  panelSize,
  children,
  blocks,
  isPolling,
  onUnminimize,
  ref,
}: PanelContainersProps) {
  const statusText = blocks && blocks.length > 0 ? getStatusText(blocks) : t('Ready');
  return (
    <AnimatePresence>
      {isOpen && (
        <PanelContainer
          panelSize={panelSize}
          isMinimized={isMinimized}
          initial={{
            opacity: 0,
            x: 50,
            y: 50,
            scale: 0.95,
            transformOrigin: 'bottom right',
          }}
          animate={{
            opacity: 1,
            x: isMinimized ? 'calc(100% - 160px)' : 0,
            y: isMinimized ? 'calc(100% - 160px)' : 0,
            scale: 1,
            transformOrigin: 'bottom right',
          }}
          exit={{
            opacity: 0,
            x: isMinimized ? '100%' : 50,
            y: isMinimized ? '100%' : 50,
            scale: 0.95,
            transformOrigin: 'bottom right',
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
            mass: 1,
          }}
        >
          <PanelContent ref={ref} data-seer-explorer-root="">
            {children}
            {isMinimized && (
              <MinimizedOverlay
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.12, ease: [0.4, 0, 0.2, 1]}}
                onClick={onUnminimize}
              >
                <MinimizedCorner>
                  <Flex
                    direction="column"
                    align="center"
                    gap="sm"
                    style={{width: '100%'}}
                  >
                    <IconSeer animation={isPolling ? 'loading' : 'waiting'} size="lg" />
                    <Text size="xs">{t('Tab ⇥ to continue')}</Text>
                    <Text size="xs" variant="muted" ellipsis style={{maxWidth: '100%'}}>
                      {statusText}
                    </Text>
                  </Flex>
                </MinimizedCorner>
              </MinimizedOverlay>
            )}
          </PanelContent>
        </PanelContainer>
      )}
    </AnimatePresence>
  );
}

export default PanelContainers;

const PanelContainer = styled(motion.div)<{
  isMinimized: boolean;
  panelSize: 'max' | 'med';
}>`
  position: fixed;
  bottom: ${p => p.theme.space.sm};
  right: ${p => p.theme.space.sm};
  z-index: 10000;
  pointer-events: auto;

  ${p =>
    p.panelSize === 'max'
      ? `
      width: 50vw;
      height: calc(100vh - ${p.theme.space.lg});
    `
      : `
      width: 50vw;
      height: 60vh;
    `}

  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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
    background: ${p => p.theme.tokens.background.transparent.accent.muted};
    border-radius: inherit;
    z-index: -1;
    pointer-events: none;
  }
`;

const MinimizedCorner = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.md};
  text-align: center;
`;

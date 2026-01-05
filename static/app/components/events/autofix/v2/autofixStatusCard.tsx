import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {cardAnimationProps} from 'sentry/components/events/autofix/v2/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Block} from 'sentry/views/seerExplorer/types';
import {getToolsStringFromBlock} from 'sentry/views/seerExplorer/utils';

interface ExplorerStatusCardProps {
  /**
   * Current status of the autofix run.
   */
  status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
  /**
   * All blocks from the autofix run.
   */
  blocks?: Block[];
  /**
   * The currently loading block (if any).
   */
  loadingBlock?: Block;
  /**
   * Optional callback to open the chat.
   */
  onOpenChat?: () => void;
}

/**
 * Status card shown when the autofix run is processing.
 *
 * Displays a loading indicator and the latest tool action or message from the agent.
 */
export function ExplorerStatusCard({
  status,
  loadingBlock,
  blocks,
  onOpenChat,
}: ExplorerStatusCardProps) {
  if (status !== 'processing') {
    return null;
  }

  return (
    <ExplorerStatusCardContent
      loadingBlock={loadingBlock}
      blocks={blocks}
      onOpenChat={onOpenChat}
    />
  );
}

function ExplorerStatusCardContent({
  loadingBlock,
  blocks,
  onOpenChat,
}: {
  blocks?: Block[];
  loadingBlock?: Block;
  onOpenChat?: () => void;
}) {
  const isThinkingBlock = (block: Block): boolean => {
    const content = block.message?.content?.trim()?.toLowerCase();
    return content === 'thinking' || content === 'thinking...';
  };

  const hasUsableContent = (block: Block): boolean => {
    const content = block.message?.content?.trim();
    return !!content && !isThinkingBlock(block);
  };

  const hasCompletedToolCalls = (block: Block): boolean => {
    return getToolsStringFromBlock(block).length > 0 && !block.loading;
  };

  const isUsableBlock = (block: Block, allowLoading = false): boolean => {
    if (!block || block.message?.role === 'user') {
      return false;
    }
    if (block.loading && !allowLoading) {
      return false;
    }
    return hasUsableContent(block) || hasCompletedToolCalls(block);
  };

  const getDisplayText = (block: Block): string => {
    if (hasUsableContent(block)) {
      const content = block.message?.content?.trim();
      return content || t('Analyzing...');
    }
    const toolStrings = getToolsStringFromBlock(block);
    if (hasCompletedToolCalls(block)) {
      return toolStrings[toolStrings.length - 1] || t('Analyzing...');
    }
    return t('Analyzing...');
  };

  // Find most recent usable block: search completed blocks first, then check loadingBlock
  // Stop searching if we encounter a user message
  let displayBlock: Block | undefined;
  if (blocks && blocks.length > 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (!block) {
        continue;
      }
      // Stop searching if we encounter a user message
      if (block.message?.role === 'user') {
        break;
      }
      if (isUsableBlock(block, false)) {
        displayBlock = block;
        break;
      }
    }
  }

  // Check loadingBlock if we haven't found anything yet and it's not a user message
  if (!displayBlock && loadingBlock && loadingBlock.message?.role !== 'user') {
    if (isUsableBlock(loadingBlock, true)) {
      displayBlock = loadingBlock;
    }
  }

  const displayText = displayBlock ? getDisplayText(displayBlock) : t('Analyzing...');

  // Find the most recent block with todos (stop at user messages)
  let latestTodoBlock: Block | undefined;
  if (blocks && blocks.length > 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (!block) {
        continue;
      }
      // Stop searching if we encounter a user message
      if (block.message?.role === 'user') {
        break;
      }
      if (block.todos && block.todos.length > 0) {
        latestTodoBlock = block;
        break;
      }
    }
  }

  // Check loadingBlock if we haven't found anything yet and it's not a user message
  if (!latestTodoBlock && loadingBlock && loadingBlock.message?.role !== 'user') {
    if (loadingBlock.todos && loadingBlock.todos.length > 0) {
      latestTodoBlock = loadingBlock;
    }
  }

  const todos = latestTodoBlock?.todos ?? [];
  const totalTodos = todos.length;
  const completedTodos = todos.filter(todo => todo.status === 'completed').length;

  return (
    <AnimatedStatusCard {...cardAnimationProps}>
      <Container padding="xl" border="primary" radius="md" background="primary">
        <Flex direction="column" gap="xl">
          <Container borderBottom="primary" paddingBottom="xl">
            <Flex align="center" gap="lg">
              <StyledLoadingIndicator size={18} />
              <Text size="md" ellipsis>
                {displayText}
              </Text>
            </Flex>
          </Container>
          {onOpenChat && (
            <Flex align="center" justify="between">
              <Button
                size="md"
                onClick={onOpenChat}
                priority="primary"
                icon={<IconChat />}
              >
                {t('Open Chat')}
              </Button>
              {totalTodos > 0 && (
                <Text variant="muted">
                  {`${completedTodos}/${totalTodos} ${t('todos completed')}`}
                </Text>
              )}
            </Flex>
          )}
        </Flex>
      </Container>
    </AnimatedStatusCard>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
  padding: 0;
  line-height: 0;

  .loading-indicator {
    border-width: 2px;
  }
`;

const AnimatedStatusCard = styled(motion.div)`
  transform-origin: top center;
`;

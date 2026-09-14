import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';

export function WorkingIndicator({
  blocks,
  children,
}: {
  blocks: AutofixSection['blocks'];
  children: React.ReactNode;
}) {
  const {containerRef, onScrollHandler} = useAutoScroll({key: blocks});
  const currentStepStart = blocks.findLastIndex(
    block => block.message.metadata?.step !== undefined
  );
  const currentStepBlocks = blocks.slice(Math.max(0, currentStepStart));

  return (
    <Stack
      ref={containerRef}
      gap="md"
      maxHeight="200px"
      overflowY="auto"
      onScroll={onScrollHandler}
    >
      {currentStepBlocks.map(block => {
        if (block.message.role === 'user') {
          return null;
        }

        if (block.message.content && block.message.content !== 'Thinking...') {
          return <Markdown key={block.id} raw={block.message.content} />;
        }

        if (block.message.thinking_content) {
          return <Markdown key={block.id} raw={block.message.thinking_content} />;
        }

        return null;
      })}
      <Flex align="center" gap="sm" paddingTop="xs">
        <WorkingSpinner size={16} />
        <Text variant="muted">{children}</Text>
      </Flex>
    </Stack>
  );
}

const WorkingSpinner = styled(LoadingIndicator)`
  margin: 0;
`;

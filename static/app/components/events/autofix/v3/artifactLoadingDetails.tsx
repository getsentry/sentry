import {Spinner} from '@sentry/scraps/chat';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';
import {hasValidContent} from 'sentry/views/seerExplorer/components/chat/shared';
import {isSeerErrorBlock} from 'sentry/views/seerExplorer/types';

import {ArtifactDetails} from './artifactDetails';

interface ArtifactLoadingDetailsProps {
  blocks: AutofixSection['blocks'];
  loadingMessage: string;
}

export function ArtifactLoadingDetails({
  loadingMessage,
  blocks,
}: ArtifactLoadingDetailsProps) {
  return (
    <ArtifactBlocks blocks={blocks}>
      <Flex align="center" gap="md">
        <Spinner />
        <Text variant="muted" density="compressed">
          {loadingMessage}
        </Text>
      </Flex>
    </ArtifactBlocks>
  );
}

/**
 * What a step wrote before it stopped, without the loading indicator. Seer's
 * own error block is left out, since the caller explains why the step stopped.
 */
export function ArtifactPartialDetails({blocks}: {blocks: AutofixSection['blocks']}) {
  const partialBlocks = blocks.filter(block => !isSeerErrorBlock(block));
  if (!partialBlocks.some(hasBlockText)) {
    return null;
  }
  return <ArtifactBlocks blocks={partialBlocks} />;
}

function hasBlockText(block: AutofixSection['blocks'][number]): boolean {
  return (
    block.message.role !== 'user' &&
    ((hasValidContent(block.message.content) &&
      block.message.content !== 'Thinking...') ||
      hasValidContent(block.message.thinking_content))
  );
}

function ArtifactBlocks({
  blocks,
  children,
}: {
  blocks: AutofixSection['blocks'];
  children?: React.ReactNode;
}) {
  const {containerRef, onScrollHandler} = useAutoScroll({key: blocks});

  return (
    <ArtifactDetails>
      <Stack
        gap="md"
        ref={containerRef}
        maxHeight="200px"
        overflowY="auto"
        onScroll={onScrollHandler}
      >
        {blocks.map((block, index) => {
          if (block.message.role === 'user') {
            // The user role is used to pass the prompts
            return null;
          }

          // A block still being written can end mid-embed; streaming hides the
          // unclosed tag until its closer arrives instead of flashing raw syntax.
          const variant = block.loading ? 'streaming' : 'static';

          if (
            hasValidContent(block.message.content) &&
            block.message.content !== 'Thinking...'
          ) {
            return (
              <SeerMarkdown key={index} raw={block.message.content} variant={variant} />
            );
          }

          if (hasValidContent(block.message.thinking_content)) {
            return (
              <SeerMarkdown
                key={index}
                raw={block.message.thinking_content}
                variant={variant}
              />
            );
          }

          return null;
        })}
        {children}
      </Stack>
    </ArtifactDetails>
  );
}

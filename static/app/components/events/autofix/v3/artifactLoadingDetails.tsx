import {useCallback, useEffect, useRef, useState, type UIEventHandler} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {StyledMarkedText} from 'sentry/components/events/autofix/v3/styled';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {defined} from 'sentry/utils';

interface ArtifactLoadingDetailsProps {
  blocks: AutofixSection['blocks'];
  loadingMessage: string;
}

export function ArtifactLoadingDetails({
  loadingMessage,
  blocks,
}: ArtifactLoadingDetailsProps) {
  const {containerRef, bottomRef, onScrollHandler} = useAutoScroll(blocks);

  return (
    <ArtifactDetails>
      <Flex
        direction="column"
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

          if (block.message.content && block.message.content !== 'Thinking...') {
            return <StyledMarkedText key={index} text={block.message.content} />;
          }

          if (block.message.thinking_content) {
            return <StyledMarkedText key={index} text={block.message.thinking_content} />;
          }

          return null;
        })}
        <Flex ref={bottomRef} direction="row" gap="md">
          <StyledLoadingIndicator size={16} />
          <Text variant="muted">{loadingMessage}</Text>
        </Flex>
      </Flex>
    </ArtifactDetails>
  );
}

function useAutoScroll(blocks: AutofixSection['blocks']) {
  const [canAutoScroll, setCanAutoScroll] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const bottom = bottomRef.current;
    if (!canAutoScroll || !defined(container) || !defined(bottom)) {
      return;
    }

    if (container.scrollHeight <= container.clientHeight) {
      return;
    }

    bottomRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
  }, [blocks, canAutoScroll]);

  const onScrollHandler: UIEventHandler = useCallback(event => {
    const {scrollTop, scrollHeight, clientHeight} = event.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 1;
    setCanAutoScroll(atBottom);
  }, []);

  return {
    containerRef,
    bottomRef,
    onScrollHandler,
  };
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

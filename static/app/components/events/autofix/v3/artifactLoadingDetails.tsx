import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useAutoScroll} from 'sentry/utils/useAutoScroll';

interface ArtifactLoadingDetailsProps {
  blocks: AutofixSection['blocks'];
  loadingMessage: string;
}

export function ArtifactLoadingDetails({
  loadingMessage,
  blocks,
}: ArtifactLoadingDetailsProps) {
  const {containerRef, onScrollHandler} = useAutoScroll({
    enabled: true,
    key: blocks,
  });

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

          if (block.message.content && block.message.content !== 'Thinking...') {
            return <Markdown key={index} raw={block.message.content} />;
          }

          if (block.message.thinking_content) {
            return <Markdown key={index} raw={block.message.thinking_content} />;
          }

          return null;
        })}
        <Flex direction="row" gap="md">
          <StyledLoadingIndicator size={16} />
          <Text variant="muted" density="compressed">
            {loadingMessage}
          </Text>
        </Flex>
      </Stack>
    </ArtifactDetails>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

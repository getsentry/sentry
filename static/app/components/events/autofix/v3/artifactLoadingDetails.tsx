import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {type AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {StyledMarkedText} from 'sentry/components/events/autofix/v3/styled';
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
        <Flex direction="row" gap="md">
          <StyledLoadingIndicator size={16} />
          <Text variant="muted">{loadingMessage}</Text>
        </Flex>
      </Flex>
    </ArtifactDetails>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

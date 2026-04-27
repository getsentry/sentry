import {useCallback, useMemo} from 'react';
import {parseAsInteger, parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {ExploreBodyContent} from 'sentry/views/explore/components/styles';
import {ConversationSummary} from 'sentry/views/explore/conversations/components/conversationSummary';
import {ConversationViewContent} from 'sentry/views/explore/conversations/components/conversationView';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';

function useConversationDetailQueryState() {
  return useQueryStates(
    {
      spanId: parseAsString,
      focusedTool: parseAsString,
      start: parseAsInteger,
      end: parseAsInteger,
    },
    {history: 'replace'}
  );
}

function ConversationDetailPage() {
  const {conversationId} = useParams<{conversationId: string}>();
  const [queryState, setQueryState] = useConversationDetailQueryState();

  const conversation = useMemo(
    () => ({
      conversationId,
      startTimestamp: queryState.start ?? undefined,
      endTimestamp: queryState.end ?? undefined,
    }),
    [conversationId, queryState.start, queryState.end]
  );

  const {nodes, nodeTraceMap, isLoading} = useConversation(conversation);

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setQueryState({spanId, focusedTool: null});
    },
    [setQueryState]
  );

  return (
    <ExploreBodyContent>
      <Stack flex={1} padding="md 2xl" gap="md">
        <Flex direction="column" gap="md" padding="0 0 xl 0">
          <ConversationSummary
            nodes={nodes}
            nodeTraceMap={nodeTraceMap}
            conversationId={conversationId}
            isLoading={isLoading}
          />
        </Flex>
        <ConversationViewContainer>
          <ConversationViewContent
            conversation={conversation}
            selectedSpanId={queryState.spanId}
            onSelectSpan={handleSelectSpan}
            focusedTool={queryState.focusedTool}
          />
        </ConversationViewContainer>
      </Stack>
    </ExploreBodyContent>
  );
}

function ConversationViewContainer({children}: {children: React.ReactNode}) {
  return (
    <Container
      flex={1}
      minHeight="0"
      overflow="hidden"
      border="primary"
      radius="md"
      display="flex"
    >
      <Flex flex={1} minHeight="0" height="100%">
        {children}
      </Flex>
    </Container>
  );
}

export default ConversationDetailPage;

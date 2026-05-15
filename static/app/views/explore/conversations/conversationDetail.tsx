import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {ConversationSummary} from 'sentry/views/explore/conversations/components/conversationSummary';
import {ConversationViewContent} from 'sentry/views/explore/conversations/components/conversationView';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';

function useConversationDetailQueryState() {
  return useQueryStates(
    {
      spanId: parseAsString,
      focusedTool: parseAsString,
    },
    {history: 'replace'}
  );
}

function ConversationDetailPage() {
  const organization = useOrganization();
  const {conversationId} = useParams<{conversationId: string}>();
  const [queryState, setQueryState] = useConversationDetailQueryState();

  const conversation = useMemo(() => ({conversationId}), [conversationId]);

  const {nodes, nodeTraceMap, isLoading} = useConversation(conversation);

  useEffect(() => {
    trackAnalytics('conversations.detail.page-view', {
      organization,
    });
  }, [organization]);

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      trackAnalytics('conversations.detail.select-span', {
        organization,
      });
      setQueryState({spanId, focusedTool: null});
    },
    [organization, setQueryState]
  );

  return (
    <ViewportConstrainedPage background="secondary">
      <Stack flex={1} minHeight="0" overflow="hidden" padding="md 2xl" gap="md">
        <Flex direction="column" gap="md" flexShrink={0}>
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
    </ViewportConstrainedPage>
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
      background="primary"
      display="flex"
    >
      <Flex flex={1} minHeight="0" height="100%">
        {children}
      </Flex>
    </Container>
  );
}

export default ConversationDetailPage;

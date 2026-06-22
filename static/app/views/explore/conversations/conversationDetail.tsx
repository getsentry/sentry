import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {ConversationHeaderV2} from 'sentry/views/explore/conversations/components/conversationHeaderV2';
import {ConversationViewV2Content} from 'sentry/views/explore/conversations/components/conversationViewV2';
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
    setQueryState({spanId: null, focusedTool: null});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

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
      <Stack flex={1} minHeight="0" overflow="hidden" gap="0">
        <Container
          background="primary"
          padding="md 2xl"
          flexShrink={0}
          borderBottom="primary"
        >
          <ConversationHeaderV2
            nodes={nodes}
            conversationId={conversationId}
            nodeTraceMap={nodeTraceMap}
            isLoading={isLoading}
          />
        </Container>
        <Flex flex={1} minHeight="0" padding="md 2xl" gap="md" direction="column">
          <ConversationViewV2Content
            conversation={conversation}
            selectedSpanId={queryState.spanId}
            onSelectSpan={handleSelectSpan}
            focusedTool={queryState.focusedTool}
          />
        </Flex>
      </Stack>
    </ViewportConstrainedPage>
  );
}

export default ConversationDetailPage;

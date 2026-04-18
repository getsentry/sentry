import {useCallback, useMemo} from 'react';
import {parseAsInteger, parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ConversationSummary} from 'sentry/views/insights/pages/conversations/components/conversationSummary';
import {ConversationViewContent} from 'sentry/views/insights/pages/conversations/components/conversationView';
import {useConversation} from 'sentry/views/insights/pages/conversations/hooks/useConversation';

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
  const organization = useOrganization();

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <Feature
        features="gen-ai-conversations"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <ConversationDetailContent />
      </Feature>
    </Feature>
  );
}

function ConversationDetailContent() {
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
    <Layout.Body padding="md 2xl" style={{display: 'flex', flexDirection: 'column'}}>
      <Layout.Main
        width="full"
        style={{display: 'flex', flexDirection: 'column', flex: 1}}
      >
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
      </Layout.Main>
    </Layout.Body>
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

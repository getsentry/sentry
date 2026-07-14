import type React from 'react';
import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {ConversationSummary} from 'sentry/views/explore/conversations/components/conversationSummary';
import {ConversationViewContent} from 'sentry/views/explore/conversations/components/conversationView';
import {ConversationDetailPageNew} from 'sentry/views/explore/conversations/conversationDetailNew';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {hasGenAiConversationsRedesignFeature} from 'sentry/views/explore/conversations/utils/features';

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

  if (hasGenAiConversationsRedesignFeature(organization)) {
    return <ConversationDetailPageNew />;
  }

  return <ConversationDetailPageLegacy />;
}

function ConversationDetailPageLegacy() {
  const organization = useOrganization();
  const {conversationId} = useParams<{conversationId: string}>();
  const [queryState, setQueryState] = useConversationDetailQueryState();

  const conversation = useMemo(() => ({conversationId}), [conversationId]);

  const {nodes, nodeTraceMap, isLoading} = useConversation(conversation);

  useEffect(() => {
    trackAnalytics('conversations.detail.page-view', {
      organization,
    });
  }, [organization, conversationId]);

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setQueryState({spanId, focusedTool: null});
    },
    [setQueryState]
  );

  return (
    <ViewportConstrainedPage background="secondary">
      <Stack flex={1} minHeight="0" overflow="hidden" padding="md 2xl" gap="md">
        <Stack gap="md" flexShrink={0}>
          <ConversationSummary
            nodes={nodes}
            nodeTraceMap={nodeTraceMap}
            conversationId={conversationId}
            isLoading={isLoading}
          />
        </Stack>
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

export function ConversationViewContainer({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const hasConversationsRedesign = hasGenAiConversationsRedesignFeature(organization);

  return (
    <Container
      flex={1}
      minHeight="0"
      overflow="hidden"
      border={hasConversationsRedesign ? undefined : 'primary'}
      radius={hasConversationsRedesign ? undefined : 'md'}
      maxWidth={hasConversationsRedesign ? '1340px' : undefined}
      background="primary"
      display="flex"
    >
      {/*
       * No explicit `height: 100%` here: the parent Container is a flex row
       * with the default `align-items: stretch`, so this pane already fills the
       * available height. A `height: 100%` would resolve against the parent's
       * height, which is indefinite when the app is in its mobile (column)
       * layout — every browser then collapses this subtree to zero height,
       * leaving the conversation detail view blank. (TET-2690)
       */}
      <Flex flex={1} minWidth="0" minHeight="0">
        {children}
      </Flex>
    </Container>
  );
}

export default ConversationDetailPage;

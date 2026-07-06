import {useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsBoolean, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Container, Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {
  ConversationLeftPanel,
  ConversationViewSkeleton,
} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  CONVERSATION_SPAN_DETAIL_TABS,
  ConversationSpanDetail,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {
  MessagesPanelNew,
  MessagesPanelSkeleton,
} from 'sentry/views/explore/conversations/components/messagesPanelNew';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

export type ConversationViewTab = 'transcript' | 'timeline';

export const CONVERSATION_VIEW_TABS: readonly ConversationViewTab[] = [
  'transcript',
  'timeline',
];

interface ConversationViewContentNewProps {
  activeTab: ConversationViewTab;
  conversation: UseConversationsOptions;
  focusedTool?: string | null;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export function ConversationViewContentNew({
  conversation,
  activeTab,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
}: ConversationViewContentNewProps) {
  const {nodes, nodeTraceMap, isLoading, error} = useConversation(conversation);
  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    focusedTool,
    isLoading,
    // The redesign opens the span detail only when the user selects a span.
    autoSelectDefaultNode: false,
  });

  const [detailState, setDetailState] = useQueryStates(
    {
      detailOpen: parseAsBoolean.withDefault(true),
      detailTab: parseAsStringLiteral(CONVERSATION_SPAN_DETAIL_TABS).withDefault('input'),
    },
    {history: 'replace'}
  );
  const handleSelectAndOpenDetail = useCallback(
    (node: AITraceSpanNode) => {
      setDetailState({detailOpen: true});
      handleSelectNode(node);
    },
    [handleSelectNode, setDetailState]
  );

  useEffect(() => {
    if (!isLoading && !error && nodes.length === 0) {
      Sentry.captureMessage('User landed on empty conversation detail page', {
        level: 'warning',
      });
    }
  }, [isLoading, error, nodes.length]);

  const isTranscript = activeTab === 'transcript';

  // The transcript renders its own chat-shaped skeleton inside the layout below;
  // the timeline tab keeps the legacy span-detail skeleton.
  if (isLoading && !isTranscript) {
    return <ConversationViewSkeleton />;
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (!isLoading && nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <Flex flex="1" minWidth="0" minHeight="0" overflow="hidden">
        <ConversationLeftPanel>
          <Container
            containerType="inline-size"
            flex="1"
            minHeight="0"
            width="100%"
            background="secondary"
          >
            <Flex
              direction={{xs: 'column', md: 'row'}}
              height="100%"
              width="100%"
              gap="md"
              padding="md"
              minHeight="0"
              overflowY="auto"
              overflowX="hidden"
            >
              <Container
                flex="1"
                minWidth="0"
                minHeight={{xs: '320px', md: '0'}}
                padding={isTranscript ? '0' : 'md'}
                background="primary"
                border="primary"
                radius="md"
                overflowX="hidden"
                overflowY="auto"
              >
                {isTranscript ? (
                  isLoading ? (
                    <MessagesPanelSkeleton />
                  ) : (
                    <MessagesPanelNew
                      nodes={nodes}
                      selectedNodeId={selectedNode?.id ?? null}
                      onSelectNode={handleSelectAndOpenDetail}
                      nodeTraceMap={nodeTraceMap}
                    />
                  )
                ) : (
                  <AiSpanTimeline
                    nodes={nodes}
                    selectedNodeKey={selectedNode?.id ?? ''}
                    onSelectNode={handleSelectAndOpenDetail}
                    nodeTraceMap={nodeTraceMap}
                    compressGaps
                  />
                )}
              </Container>
              {detailState.detailOpen && selectedNode ? (
                <Flex
                  width={{xs: '100%', md: '430px'}}
                  flex={{xs: '1', md: '0 0 auto'}}
                  minHeight={{xs: '320px', md: '0'}}
                >
                  <ConversationSpanDetail
                    node={selectedNode}
                    traceId={nodeTraceMap?.get(selectedNode.id) ?? ''}
                    activeTab={detailState.detailTab}
                    onTabChange={detailTab => setDetailState({detailTab})}
                    onClose={() => setDetailState({detailOpen: false, detailTab: null})}
                  />
                </Flex>
              ) : null}
            </Flex>
          </Container>
        </ConversationLeftPanel>
      </Flex>
    </TraceStateProvider>
  );
}

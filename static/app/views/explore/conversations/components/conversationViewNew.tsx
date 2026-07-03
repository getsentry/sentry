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

// WIP: redesigned conversation view. The transcript tab is a placeholder while
// its content treatment is being designed.
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

  if (isLoading) {
    return <ConversationViewSkeleton />;
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <Flex flex="1" minWidth="0" minHeight="0" overflow="hidden">
        <ConversationLeftPanel>
          {activeTab === 'transcript' ? (
            <Flex flex="1" minHeight="0" overflowY="hidden" background="secondary">
              <EmptyMessage>{t('Transcript view is coming soon')}</EmptyMessage>
            </Flex>
          ) : (
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
                  padding="md"
                  background="primary"
                  border="primary"
                  radius="md"
                  overflowX="hidden"
                  overflowY="auto"
                >
                  <AiSpanTimeline
                    nodes={nodes}
                    selectedNodeKey={selectedNode?.id ?? ''}
                    onSelectNode={handleSelectAndOpenDetail}
                    nodeTraceMap={nodeTraceMap}
                    compressGaps
                  />
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
          )}
        </ConversationLeftPanel>
      </Flex>
    </TraceStateProvider>
  );
}

import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container, Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {
  ConversationLeftPanel,
  ConversationViewSkeleton,
} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
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
          <Flex flex="1" minHeight="0" overflowY="hidden" background="secondary">
            {activeTab === 'transcript' ? (
              <EmptyMessage>{t('Transcript view is coming soon')}</EmptyMessage>
            ) : (
              <Container
                padding="md"
                width="100%"
                maxWidth="900px"
                minHeight="0"
                background="primary"
                border="primary"
                radius="md"
                overflowX="hidden"
                overflowY="auto"
              >
                <AiSpanTimeline
                  nodes={nodes}
                  selectedNodeKey={selectedNode?.id ?? ''}
                  onSelectNode={handleSelectNode}
                  nodeTraceMap={nodeTraceMap}
                  compressGaps
                />
              </Container>
            )}
          </Flex>
        </ConversationLeftPanel>
      </Flex>
    </TraceStateProvider>
  );
}

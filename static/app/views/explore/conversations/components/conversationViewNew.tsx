import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {Container, Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConversationDetailPanel,
  ConversationLeftPanel,
  ConversationSplitLayout,
  ConversationViewSkeleton,
} from 'sentry/views/explore/conversations/components/conversationLayout';
import {MessagesPanel} from 'sentry/views/explore/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {
  extractMessagesFromNodes,
  messagesToMarkdown,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
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

// WIP: redesigned conversation view. Reuses the existing panels for now; the
// content treatment is still being designed.
export function ConversationViewContentNew({
  conversation,
  activeTab,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
}: ConversationViewContentNewProps) {
  const organization = useOrganization();
  const {nodes, nodeTraceMap, isLoading, error} = useConversation(conversation);
  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    focusedTool,
    isLoading,
  });

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

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
      <ConversationSplitLayout
        left={
          <ConversationLeftPanel>
            <Flex
              direction="column"
              flex="1"
              minHeight="0"
              width="100%"
              overflow="hidden"
            >
              {activeTab === 'transcript' && messages.length > 0 && (
                <Flex
                  flexShrink={0}
                  justify="end"
                  align="center"
                  padding="xs sm"
                  borderBottom="primary"
                  background="primary"
                >
                  <CopyAsDropdown
                    size="xs"
                    items={CopyAsDropdown.makeDefaultCopyAsOptions({
                      markdown: () => {
                        trackAnalytics('conversations.detail.copy-conversation', {
                          organization,
                        });
                        return messagesToMarkdown(messages);
                      },
                      text: undefined,
                      json: undefined,
                    })}
                  />
                </Flex>
              )}
              <Flex
                flex="1"
                minHeight="0"
                width="100%"
                overflowX="hidden"
                overflowY="auto"
                background="secondary"
              >
                {activeTab === 'transcript' ? (
                  <MessagesPanel
                    nodes={nodes}
                    selectedNodeId={selectedNode?.id ?? null}
                    onSelectNode={handleSelectNode}
                  />
                ) : (
                  <Container padding="md lg md lg" width="100%">
                    <AISpanList
                      nodes={nodes}
                      selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
                      onSelectNode={handleSelectNode}
                      compressGaps
                    />
                  </Container>
                )}
              </Flex>
            </Flex>
          </ConversationLeftPanel>
        }
        right={
          <ConversationDetailPanel
            selectedNode={selectedNode}
            nodeTraceMap={nodeTraceMap}
          />
        }
      />
    </TraceStateProvider>
  );
}

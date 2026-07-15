import {memo, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

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
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

type ConversationTab = 'messages' | 'trace';

interface ConversationViewContentProps {
  conversation: UseConversationsOptions;
  focusedTool?: string | null;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

/**
 * Fetches conversation data and renders the full conversation view
 * with tab switching, span selection, and detail panel.
 * Used by both the detail page and the drawer.
 */
export const ConversationViewContent = memo(function ConversationViewContent({
  conversation,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
}: ConversationViewContentProps) {
  const {nodes, nodeTraceMap, isLoading, error} = useConversation(conversation);
  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    focusedTool,
    isLoading,
  });

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <ConversationView
        nodes={nodes}
        nodeTraceMap={nodeTraceMap}
        selectedNode={selectedNode}
        onSelectNode={handleSelectNode}
        isLoading={isLoading}
        error={error}
      />
    </TraceStateProvider>
  );
});

function ConversationView({
  nodes,
  nodeTraceMap,
  selectedNode,
  onSelectNode,
  isLoading,
  error,
}: {
  error: boolean;
  isLoading: boolean;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNode: AITraceSpanNode | undefined;
}) {
  const organization = useOrganization();
  const [activeTab, setActiveTab] = useState<ConversationTab>('messages');

  useEffect(() => {
    if (!isLoading && !error && nodes.length === 0) {
      Sentry.captureMessage('User landed on empty conversation detail page', {
        level: 'warning',
      });
    }
  }, [isLoading, error, nodes.length]);

  const handleTabChange = (newTab: ConversationTab) => {
    if (activeTab !== newTab) {
      trackAnalytics('conversations.detail.tab-switch', {
        organization,
        fromTab: activeTab,
        toTab: newTab,
      });
    }
    setActiveTab(newTab);
  };

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

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
    <ConversationSplitLayout
      left={
        <ConversationLeftPanel>
          <Stack flex="1" minHeight="0" width="100%" overflow="hidden">
            <Flex
              flexShrink={0}
              align="center"
              gap="sm"
              paddingRight="sm"
              borderBottom="primary"
              background="primary"
            >
              <Flex flex={1}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                  <TabList>
                    <TabList.Item key="messages">{t('Chat')}</TabList.Item>
                    <TabList.Item key="trace">{t('Spans')}</TabList.Item>
                  </TabList>
                </Tabs>
              </Flex>
              {activeTab === 'messages' && messages.length > 0 && (
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
              )}
            </Flex>
            <Flex
              flex="1"
              minHeight="0"
              width="100%"
              overflowX="hidden"
              overflowY="auto"
              background="secondary"
            >
              {activeTab === 'messages' ? (
                <MessagesPanel
                  nodes={nodes}
                  selectedNodeId={selectedNode?.id ?? null}
                  onSelectNode={onSelectNode}
                />
              ) : (
                <Container padding="md lg md lg" width="100%">
                  <AISpanList
                    nodes={nodes}
                    selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
                    onSelectNode={onSelectNode}
                    compressGaps
                  />
                </Container>
              )}
            </Flex>
          </Stack>
        </ConversationLeftPanel>
      }
      right={
        <ConversationDetailPanel
          selectedNode={selectedNode}
          nodeTraceMap={nodeTraceMap}
        />
      }
    />
  );
}

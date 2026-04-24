import {memo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

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

  const handleTabChange = (newTab: ConversationTab) => {
    if (activeTab !== newTab) {
      trackAnalytics('conversations.drawer.tab-switch', {
        organization,
        fromTab: activeTab,
        toTab: newTab,
      });
    }
    setActiveTab(newTab);
  };

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
          <StyledTabs
            value={activeTab}
            onChange={key => handleTabChange(key as ConversationTab)}
          >
            <Container borderBottom="primary">
              <TabList>
                <TabList.Item key="messages">{t('Chat')}</TabList.Item>
                <TabList.Item key="trace">{t('Spans')}</TabList.Item>
              </TabList>
            </Container>
            <Flex flex="1" minHeight="0" width="100%" overflowX="hidden" overflowY="auto">
              <FullWidthTabPanels>
                <TabPanels.Item key="messages">
                  <MessagesPanel
                    nodes={nodes}
                    selectedNodeId={selectedNode?.id ?? null}
                    onSelectNode={onSelectNode}
                  />
                </TabPanels.Item>
                <TabPanels.Item key="trace">
                  <Container padding="md lg md lg">
                    <AISpanList
                      nodes={nodes}
                      selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
                      onSelectNode={onSelectNode}
                      compressGaps
                    />
                  </Container>
                </TabPanels.Item>
              </FullWidthTabPanels>
            </Flex>
          </StyledTabs>
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

const StyledTabs = styled(Tabs)`
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const FullWidthTabPanels = styled(TabPanels)`
  width: 100%;
  padding: 0;

  > [role='tabpanel'] {
    width: 100%;
  }
`;

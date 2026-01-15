import {memo, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {MessagesPanel} from 'sentry/views/insights/pages/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import {useUrlConversationDrawer} from 'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer';
import {useConversationDrawerQueryState} from 'sentry/views/insights/pages/conversations/utils/urlParams';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

const LEFT_PANEL_WIDTH = 400;
const DETAILS_PANEL_WIDTH = 500;
const DRAWER_WIDTH = LEFT_PANEL_WIDTH + DETAILS_PANEL_WIDTH;

type ConversationTab = 'messages' | 'trace';

interface UseConversationViewDrawerProps {
  onClose?: () => void;
}

const ConversationDrawerContent = memo(function ConversationDrawerContent({
  conversation,
}: {
  conversation: UseConversationsOptions;
}) {
  const organization = useOrganization();
  const {nodes, nodeTraceMap, isLoading, error} = useConversation(conversation);
  const [conversationDrawerQueryState, setConversationDrawerQueryState] =
    useConversationDrawerQueryState();
  const selectedNodeKey = conversationDrawerQueryState.spanId;

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      setConversationDrawerQueryState({
        spanId: node.id,
      });
      trackAnalytics('agent-monitoring.conversation-drawer.span-select', {
        organization,
      });
    },
    [setConversationDrawerQueryState, organization]
  );

  const selectedNode =
    (selectedNodeKey && nodes.find(node => node.id === selectedNodeKey)) ||
    getDefaultSelectedNode(nodes);

  return (
    <Stack height="100%">
      <StyledDrawerHeader>
        <Flex align="center" flex="1" gap="md">
          {t('Conversation')}
          <ConversationIdLabel>
            {conversation.conversationId.slice(0, 8)}
          </ConversationIdLabel>
        </Flex>
      </StyledDrawerHeader>
      <StyledDrawerBody>
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
      </StyledDrawerBody>
    </Stack>
  );
});

export function useConversationViewDrawer({
  onClose,
}: UseConversationViewDrawerProps = {}) {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, drawerUrlState} = useUrlConversationDrawer();

  const openConversationViewDrawer = useCallback(
    (conversation: UseConversationsOptions) => {
      trackAnalytics('agent-monitoring.conversation-drawer.open', {
        organization,
      });

      return openDrawer(() => <ConversationDrawerContent conversation={conversation} />, {
        ariaLabel: t('Conversation'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: `${DRAWER_WIDTH}px`,
        resizable: true,
        conversationId: conversation.conversationId,
        drawerKey: 'conversation-view-drawer',
      });
    },
    [openDrawer, onClose, organization]
  );

  useEffect(() => {
    const {conversationId} = drawerUrlState;
    if (conversationId && !isDrawerOpen) {
      openConversationViewDrawer({conversationId});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  return {
    openConversationViewDrawer,
    isConversationViewDrawerOpen: isDrawerOpen,
  };
}

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

  if (isLoading) {
    return (
      <Flex justify="center" align="center" flex="1" height="100%">
        <LoadingIndicator size={32}>{t('Loading conversation...')}</LoadingIndicator>
      </Flex>
    );
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <Flex flex="1" minHeight="0">
      <LeftPanel>
        <StyledTabs
          value={activeTab}
          onChange={key => setActiveTab(key as ConversationTab)}
        >
          <StyledTabList>
            <TabList.Item key="messages">{t('Messages')}</TabList.Item>
            <TabList.Item key="trace">{t('AI Spans')}</TabList.Item>
          </StyledTabList>
          <StyledTabPanels>
            <TabPanels.Item key="messages">
              <TabContent>
                <MessagesPanel
                  nodes={nodes}
                  selectedNodeId={selectedNode?.id ?? null}
                  onSelectNode={onSelectNode}
                />
              </TabContent>
            </TabPanels.Item>
            <TabPanels.Item key="trace">
              <TabContentPadded>
                <AISpanList
                  nodes={nodes}
                  selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
                  onSelectNode={onSelectNode}
                  compressGaps
                />
              </TabContentPadded>
            </TabPanels.Item>
          </StyledTabPanels>
        </StyledTabs>
      </LeftPanel>
      <DetailsPanel>
        {selectedNode?.renderDetails({
          node: selectedNode,
          manager: null,
          onParentClick: () => {},
          onTabScrollToNode: () => {},
          organization,
          replay: null,
          traceId: nodeTraceMap.get(selectedNode.id) ?? '',
          hideNodeActions: true,
        })}
      </DetailsPanel>
    </Flex>
  );
}

const StyledDrawerBody = styled(DrawerBody)`
  padding: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const LeftPanel = styled('div')`
  width: ${LEFT_PANEL_WIDTH}px;
  min-width: ${LEFT_PANEL_WIDTH}px;
  min-height: 0;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledTabs = styled(Tabs)`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const StyledTabList = styled(TabList)`
  flex-shrink: 0;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg} 0;
`;

const StyledTabPanels = styled(TabPanels)`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  > [role='tabpanel'] {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
`;

const TabContent = styled('div')`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
`;

const TabContentPadded = styled(TabContent)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const DetailsPanel = styled('div')`
  min-width: ${DETAILS_PANEL_WIDTH}px;
  flex: 1;
  min-height: 0;
  background-color: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  overflow-x: hidden;
`;

const StyledDrawerHeader = styled(DrawerHeader)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  display: flex;
`;

const ConversationIdLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import EmptyMessage from 'sentry/components/emptyMessage';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ConversationDrawerOpenSource} from 'sentry/utils/analytics/conversationsAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import {getIsExecuteToolSpan} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {MessagesPanel} from 'sentry/views/insights/pages/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import {useUrlConversationDrawer} from 'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer';
import {useConversationDrawerQueryState} from 'sentry/views/insights/pages/conversations/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';
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
  const focusedTool = conversationDrawerQueryState.focusedTool;
  const hasProcessedFocusedTool = useRef(false);

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      setConversationDrawerQueryState({
        spanId: node.id,
        focusedTool: null,
      });
      trackAnalytics('conversations.drawer.span-select', {
        organization,
      });
    },
    [setConversationDrawerQueryState, organization]
  );

  const defaultNodeId = useMemo(() => getDefaultSelectedNode(nodes)?.id, [nodes]);

  const selectedNode = useMemo(() => {
    return (
      nodes.find(node => node.id === selectedNodeKey) ??
      nodes.find(node => node.id === defaultNodeId)
    );
  }, [nodes, selectedNodeKey, defaultNodeId]);

  // Handle focusedTool param - find first tool span with matching name
  useEffect(() => {
    if (isLoading || !focusedTool || hasProcessedFocusedTool.current) {
      return;
    }

    const toolSpan = nodes.find(node => {
      const opType = node.attributes?.[SpanFields.GEN_AI_OPERATION_TYPE] as
        | string
        | undefined;
      const toolName = node.attributes?.[SpanFields.GEN_AI_TOOL_NAME] as
        | string
        | undefined;
      return getIsExecuteToolSpan(opType) && toolName === focusedTool;
    });

    if (toolSpan) {
      hasProcessedFocusedTool.current = true;
      setConversationDrawerQueryState({
        spanId: toolSpan.id,
        focusedTool: null,
      });
    }
  }, [isLoading, focusedTool, nodes, setConversationDrawerQueryState]);

  useEffect(() => {
    if (isLoading || !defaultNodeId || focusedTool) {
      return;
    }

    const isCurrentSpanValid =
      selectedNodeKey && nodes.some(node => node.id === selectedNodeKey);

    if (!isCurrentSpanValid) {
      setConversationDrawerQueryState({
        spanId: defaultNodeId,
      });
    }
  }, [
    isLoading,
    defaultNodeId,
    selectedNodeKey,
    nodes,
    setConversationDrawerQueryState,
    focusedTool,
  ]);

  return (
    <Stack height="100%">
      <StyledDrawerHeader>
        <Flex align="center" flex="1" gap="md">
          {t('Conversation')}
          <Text variant="muted" size="sm" monospace>
            {conversation.conversationId.slice(0, 8)}
          </Text>
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
    ({
      conversation,
      source,
      focusedTool,
    }: {
      conversation: UseConversationsOptions;
      source: ConversationDrawerOpenSource;
      focusedTool?: string;
    }) => {
      trackAnalytics('conversations.drawer.open', {
        organization,
        source,
      });

      return openDrawer(() => <ConversationDrawerContent conversation={conversation} />, {
        ariaLabel: t('Conversation'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: `${DRAWER_WIDTH}px`,
        resizable: true,
        conversationId: conversation.conversationId,
        startTimestamp: conversation.startTimestamp,
        endTimestamp: conversation.endTimestamp,
        focusedTool,
        drawerKey: 'conversation-view-drawer',
      });
    },
    [openDrawer, onClose, organization]
  );

  useEffect(() => {
    const {conversationId, startTimestamp, endTimestamp} = drawerUrlState;
    if (conversationId && !isDrawerOpen) {
      openConversationViewDrawer({
        conversation: {
          conversationId,
          startTimestamp: startTimestamp ?? undefined,
          endTimestamp: endTimestamp ?? undefined,
        },
        source: 'direct_link',
      });
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

  const handleTabChange = useCallback(
    (newTab: ConversationTab) => {
      if (activeTab !== newTab) {
        trackAnalytics('conversations.drawer.tab-switch', {
          organization,
          fromTab: activeTab,
          toTab: newTab,
        });
      }
      setActiveTab(newTab);
    },
    [organization, activeTab]
  );

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
          onChange={key => handleTabChange(key as ConversationTab)}
        >
          <Container padding="xs lg">
            <TabList>
              <TabList.Item key="messages">{t('Messages')}</TabList.Item>
              <TabList.Item key="trace">{t('AI Spans')}</TabList.Item>
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
                <Container padding="md lg">
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
  min-height: 0;
`;

const FullWidthTabPanels = styled(TabPanels)`
  width: 100%;

  > [role='tabpanel'] {
    width: 100%;
  }
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

import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import EmptyMessage from 'sentry/components/emptyMessage';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ConversationDrawerOpenSource} from 'sentry/utils/analytics/conversationsAnalyticsEvents';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {ConversationSummary} from 'sentry/views/insights/pages/conversations/components/conversationSummary';
import {MessagesPanel} from 'sentry/views/insights/pages/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import {useFocusedToolSpan} from 'sentry/views/insights/pages/conversations/hooks/useFocusedToolSpan';
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
  const focusedTool = conversationDrawerQueryState.focusedTool;

  useFocusedToolSpan({
    nodes,
    focusedTool,
    isLoading,
    onSpanFound: useCallback(
      (spanId: string) => {
        setConversationDrawerQueryState({
          spanId,
          focusedTool: null,
        });
      },
      [setConversationDrawerQueryState]
    ),
  });

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
    <Flex direction="column" height="100%">
      <DrawerHeader>
        <ConversationSummary
          nodes={nodes}
          conversationId={conversation.conversationId}
          isLoading={isLoading}
        />
      </DrawerHeader>
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
    </Flex>
  );
});

export function useConversationViewDrawer({
  onClose,
}: UseConversationViewDrawerProps = {}) {
  const theme = useTheme();
  const organization = useOrganization();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.md})`);
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
        drawerWidth: isSmallScreen ? '100%' : `${DRAWER_WIDTH}px`,
        drawerCss: isSmallScreen
          ? undefined
          : css`
              min-width: ${DRAWER_WIDTH}px;
            `,
        resizable: !isSmallScreen,
        conversationId: conversation.conversationId,
        startTimestamp: conversation.startTimestamp,
        endTimestamp: conversation.endTimestamp,
        focusedTool,
        drawerKey: 'conversation-view-drawer',
      });
    },
    [openDrawer, onClose, organization, isSmallScreen]
  );

  useEffect(() => {
    const {conversationId, startTimestamp, endTimestamp, focusedTool} = drawerUrlState;
    if (conversationId && !isDrawerOpen) {
      openConversationViewDrawer({
        conversation: {
          conversationId,
          startTimestamp: startTimestamp ?? undefined,
          endTimestamp: endTimestamp ?? undefined,
        },
        focusedTool: focusedTool ?? undefined,
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
  const theme = useTheme();
  const organization = useOrganization();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.md})`);
  const [showDetails, setShowDetails] = useState(false);
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

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      onSelectNode(node);
      if (isSmallScreen) {
        setShowDetails(true);
      }
    },
    [onSelectNode, isSmallScreen]
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

  const showListPanel = !isSmallScreen || !showDetails;
  const showDetailsPanel = !isSmallScreen || showDetails;

  return (
    <Flex flex="1" minHeight="0">
      {showListPanel && (
        <LeftPanel isFullWidth={isSmallScreen}>
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
            <Flex
              flex="1"
              minHeight="0"
              width="100%"
              overflowX="hidden"
              overflowY="auto"
            >
              <FullWidthTabPanels>
                <TabPanels.Item key="messages">
                  <MessagesPanel
                    nodes={nodes}
                    selectedNodeId={selectedNode?.id ?? null}
                    onSelectNode={handleSelectNode}
                  />
                </TabPanels.Item>
                <TabPanels.Item key="trace">
                  <Container padding="md lg">
                    <AISpanList
                      nodes={nodes}
                      selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
                      onSelectNode={handleSelectNode}
                      compressGaps
                    />
                  </Container>
                </TabPanels.Item>
              </FullWidthTabPanels>
            </Flex>
          </StyledTabs>
        </LeftPanel>
      )}
      {showDetailsPanel && (
        <DetailsPanel isFullWidth={isSmallScreen}>
          {isSmallScreen && (
            <Container padding="sm lg" borderBottom="primary">
              <Button
                size="xs"
                priority="transparent"
                icon={<IconChevron direction="left" />}
                onClick={() => setShowDetails(false)}
              >
                {t('Back')}
              </Button>
            </Container>
          )}
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
      )}
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

const LeftPanel = styled('div')<{isFullWidth?: boolean}>`
  flex: 1;
  min-width: ${p => (p.isFullWidth ? '0' : `${LEFT_PANEL_WIDTH}px`)};
  min-height: 0;
  border-right: ${p => (p.isFullWidth ? 'none' : `1px solid ${p.theme.tokens.border.primary}`)};
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

const DetailsPanel = styled('div')<{isFullWidth?: boolean}>`
  width: ${p => (p.isFullWidth ? '100%' : `${DETAILS_PANEL_WIDTH}px`)};
  min-width: ${p => (p.isFullWidth ? '0' : `${DETAILS_PANEL_WIDTH}px`)};
  flex: ${p => (p.isFullWidth ? '1' : 'none')};
  min-height: 0;
  background-color: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  overflow-x: hidden;
`;

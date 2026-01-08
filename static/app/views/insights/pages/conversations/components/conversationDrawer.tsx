import {memo, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {ConversationUserCell} from 'sentry/views/insights/pages/conversations/components/conversationUserCell';
import {MessagesPanel} from 'sentry/views/insights/pages/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import type {ConversationUser} from 'sentry/views/insights/pages/conversations/hooks/useConversations';
import {useUrlConversationDrawer} from 'sentry/views/insights/pages/conversations/hooks/useUrlConversationDrawer';
import {useConversationDrawerQueryState} from 'sentry/views/insights/pages/conversations/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

/**
 * Extract user data from the first node in the conversation.
 * Nodes are sorted by timestamp, so the first node represents the earliest span.
 */
function extractUserFromNodes(nodes: AITraceSpanNode[]): ConversationUser | null {
  for (const node of nodes) {
    if (isEAPSpanNode(node)) {
      const attrs = node.value.additional_attributes;
      const userId = attrs?.[SpanFields.USER_ID] as string | undefined;
      const userEmail = attrs?.[SpanFields.USER_EMAIL] as string | undefined;
      const userUsername = attrs?.[SpanFields.USER_USERNAME] as string | undefined;
      const userIp = attrs?.[SpanFields.USER_IP] as string | undefined;

      if (userId || userEmail || userUsername || userIp) {
        return {
          id: userId ?? null,
          email: userEmail ?? null,
          username: userUsername ?? null,
          ip_address: userIp ?? null,
        };
      }
    }
  }
  return null;
}

const CONVERSATION_PANEL_WIDTH = 350;
const TRACE_PANEL_WIDTH = 350;
const DETAILS_PANEL_WIDTH = 500;
const DRAWER_WIDTH = CONVERSATION_PANEL_WIDTH + TRACE_PANEL_WIDTH + DETAILS_PANEL_WIDTH;

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

  const user = useMemo(() => extractUserFromNodes(nodes), [nodes]);

  return (
    <DrawerWrapper>
      <StyledDrawerHeader>
        <HeaderContent>
          {t('Conversation')}
          <ConversationIdLabel>
            {conversation.conversationId.slice(0, 8)}
          </ConversationIdLabel>
          <HeaderDivider />
          <ConversationUserCell user={user} />
        </HeaderContent>
      </StyledDrawerHeader>
      <StyledDrawerBody>
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <ConversationView
            conversation={conversation}
            nodes={nodes}
            nodeTraceMap={nodeTraceMap}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
            isLoading={isLoading}
            error={error}
          />
        </TraceStateProvider>
      </StyledDrawerBody>
    </DrawerWrapper>
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
        traceIds: conversation.traceIds,
        drawerKey: 'conversation-view-drawer',
      });
    },
    [openDrawer, onClose, organization]
  );

  useEffect(() => {
    const {conversationId, traceIds} = drawerUrlState;
    if (conversationId && traceIds?.length && !isDrawerOpen) {
      openConversationViewDrawer({conversationId, traceIds});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  return {
    openConversationViewDrawer,
    isConversationViewDrawerOpen: isDrawerOpen,
  };
}

function ConversationView({
  conversation,
  nodes,
  nodeTraceMap,
  selectedNode,
  onSelectNode,
  isLoading,
  error,
}: {
  conversation: UseConversationsOptions;
  error: boolean;
  isLoading: boolean;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNode: AITraceSpanNode | undefined;
}) {
  const organization = useOrganization();

  if (isLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator size={32}>{t('Loading conversation...')}</LoadingIndicator>
      </LoadingContainer>
    );
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <SplitContainer>
      <MessagesPanel
        nodes={nodes}
        selectedNodeId={selectedNode?.id ?? null}
        onSelectNode={onSelectNode}
      />
      <TracePanel>
        <PanelHeader>{t('AI Trace')}</PanelHeader>
        <AISpanList
          nodes={nodes}
          selectedNodeKey={selectedNode?.id ?? nodes[0]?.id ?? ''}
          onSelectNode={onSelectNode}
        />
      </TracePanel>
      <DetailsPanel>
        {selectedNode?.renderDetails({
          node: selectedNode,
          manager: null,
          onParentClick: () => {},
          onTabScrollToNode: () => {},
          organization,
          replay: null,
          traceId: nodeTraceMap.get(selectedNode.id) ?? conversation.traceIds[0] ?? '',
          hideNodeActions: true,
        })}
      </DetailsPanel>
    </SplitContainer>
  );
}

const StyledDrawerBody = styled(DrawerBody)`
  padding: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const SplitContainer = styled('div')`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const TracePanel = styled('div')`
  width: ${TRACE_PANEL_WIDTH}px;
  min-width: ${TRACE_PANEL_WIDTH}px;
  min-height: 0;
  padding: 0 ${p => p.theme.space.md};
  border-right: 1px solid ${p => p.theme.border};
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

const DetailsPanel = styled('div')`
  min-width: ${DETAILS_PANEL_WIDTH}px;
  flex: 1;
  min-height: 0;
  background-color: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  overflow-x: hidden;
`;

const PanelHeader = styled('h6')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  padding: ${p => p.theme.space.md} 0;
  margin: 0;
  flex-shrink: 0;
`;

const DrawerWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  flex: 1;
`;

const StyledDrawerHeader = styled(DrawerHeader)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  display: flex;
`;

const HeaderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const ConversationIdLabel = styled('span')`
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

const HeaderDivider = styled('span')`
  width: 1px;
  height: 16px;
  background: ${p => p.theme.border};
`;

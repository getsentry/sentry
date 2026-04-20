import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  ConversationDetailPanel,
  ConversationLeftPanel,
  ConversationSplitLayout,
} from 'sentry/views/insights/pages/conversations/components/conversationLayout';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getScrollToPath} from 'sentry/views/performance/newTraceDetails/useTraceScrollToPath';

function useAiSpanSelection(nodes: AITraceSpanNode[]) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(() => {
    const path = getScrollToPath()?.path;
    const lastSpan = path?.findLast(item => item.startsWith('span-'));
    return lastSpan?.replace('span-', '') ?? null;
  });

  useEffect(() => {
    trackAnalytics('agent-monitoring.trace.rendered', {
      organization,
    });
  }, [organization]);

  const selectedNode = useMemo(() => {
    return (
      nodes.find(node => node.id === selectedNodeKey) || getDefaultSelectedNode(nodes)
    );
  }, [nodes, selectedNodeKey]);

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      const eventId = node.id;
      if (!eventId) {
        return;
      }
      setSelectedNodeKey(eventId);

      trackAnalytics('agent-monitoring.trace.span-select', {
        organization,
      });

      const nodeIdentifier: TraceTree.NodePath = `span-${eventId}`;
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            node: nodeIdentifier,
          },
        },
        {replace: true}
      );
    },
    [location, navigate, organization]
  );

  return {selectedNode, handleSelectNode};
}

interface TraceAiSpansProps {
  traceSlug: string;
  error?: boolean;
  isLoading?: boolean;
  nodes?: AITraceSpanNode[];
}

/**
 * Standalone AI spans view with full chrome (border, header, "View in Full Trace").
 * Used when there are no conversations in the trace.
 */
export function TraceAiSpans({
  traceSlug,
  nodes: externalNodes,
  isLoading: externalIsLoading,
  error: externalError,
}: TraceAiSpansProps) {
  const organization = useOrganization();
  const location = useLocation();

  const aiTrace = useAITrace(traceSlug);
  const nodes = externalNodes ?? aiTrace.nodes;
  const isLoading = externalIsLoading ?? aiTrace.isLoading;
  const error = externalError ?? aiTrace.error;

  const {selectedNode, handleSelectNode} = useAiSpanSelection(nodes);

  const handleViewFullTraceClick = () => {
    trackAnalytics('agent-monitoring.trace.view-full-trace-click', {
      organization,
    });
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>{t('Failed to load trace')}</div>;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found')}</EmptyMessage>;
  }

  return (
    <Wrapper>
      <HeaderCell>{t('Abbreviated Trace')}</HeaderCell>
      <HeaderCell align="right">
        <LinkButton
          size="xs"
          onClick={handleViewFullTraceClick}
          to={{
            ...location,
            query: {
              ...location.query,
              tab: TraceLayoutTabKeys.WATERFALL,
            },
          }}
        >
          {t('View in Full Trace')}
        </LinkButton>
      </HeaderCell>
      <LeftPanel>
        <SpansHeader>{t('AI Spans')}</SpansHeader>
        <AISpanList
          nodes={nodes}
          onSelectNode={handleSelectNode}
          selectedNodeKey={selectedNode?.id ?? null}
        />
      </LeftPanel>
      <RightPanel>
        {selectedNode?.renderDetails({
          node: selectedNode,
          manager: null,
          onParentClick: () => {},
          onTabScrollToNode: () => {},
          organization,
          replay: null,
          traceId: traceSlug,
          hideNodeActions: true,
        })}
      </RightPanel>
    </Wrapper>
  );
}

/**
 * AI spans content in a resizable split layout, without chrome.
 * Used inside the conversations tabs for consistent layout.
 */
export function AiSpansSplitView({
  nodes,
  traceSlug,
}: {
  nodes: AITraceSpanNode[];
  traceSlug: string;
}) {
  const {selectedNode, handleSelectNode} = useAiSpanSelection(nodes);

  const nodeTraceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, traceSlug);
    }
    return map;
  }, [nodes, traceSlug]);

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found')}</EmptyMessage>;
  }

  return (
    <ConversationSplitLayout
      left={
        <ConversationLeftPanel>
          <Flex flex="1" minHeight="0" overflowY="auto" overflowX="hidden">
            <Container padding="md lg md lg" width="100%">
              <AISpanList
                nodes={nodes}
                onSelectNode={handleSelectNode}
                selectedNodeKey={selectedNode?.id ?? null}
              />
            </Container>
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
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(300px, 400px) 1fr;
  grid-template-rows: 38px 1fr;
  flex: 1 1 100%;
  min-height: 0;
  overflow-x: auto;
  background-color: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

const SpansHeader = styled('h6')`
  font-size: ${p => p.theme.font.size.xl};
  font-weight: bold;
  margin-bottom: ${p => p.theme.space.xl};
  margin-left: ${p => p.theme.space.md};
`;

const HeaderCell = styled('div')<{align?: 'left' | 'right'}>`
  padding: 0 ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  display: flex;
  align-items: center;
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
`;

const LeftPanel = styled('div')`
  flex: 1;
  min-width: 300px;
  min-height: 0;
  padding: ${p => p.theme.space.xl};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 400px;
`;

const RightPanel = styled('div')`
  min-width: 400px;
  padding-top: ${p => p.theme.space.md};
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
`;

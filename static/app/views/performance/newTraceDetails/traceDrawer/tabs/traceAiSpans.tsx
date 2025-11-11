import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import {getNodeId} from 'sentry/views/insights/pages/agents/utils/getNodeId';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {TraceTreeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getScrollToPath} from 'sentry/views/performance/newTraceDetails/useTraceScrollToPath';

function TraceAiSpans({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {nodes, isLoading, error} = useAITrace(traceSlug);
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
      nodes.find(node => getNodeId(node) === selectedNodeKey) ||
      getDefaultSelectedNode(nodes)
    );
  }, [nodes, selectedNodeKey]);

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      const eventId = getNodeId(node);
      if (!eventId) {
        return;
      }
      setSelectedNodeKey(eventId);

      trackAnalytics('agent-monitoring.trace.span-select', {
        organization,
      });

      // Update the node path url param to keep the trace waterfal in sync
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

  const handleViewFullTraceClick = useCallback(() => {
    trackAnalytics('agent-monitoring.trace.view-full-trace-click', {
      organization,
    });
  }, [organization]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found')}</EmptyMessage>;
  }

  if (error) {
    return <div>{t('Failed to load trace')}</div>;
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
          selectedNodeKey={getNodeId(selectedNode!)}
        />
      </LeftPanel>
      <RightPanel>
        {selectedNode && (
          <TraceTreeNodeDetails
            node={selectedNode}
            manager={null}
            onParentClick={() => {}}
            onTabScrollToNode={() => {}}
            organization={organization}
            replay={null}
            traceId={traceSlug}
            hideNodeActions
          />
        )}
      </RightPanel>
    </Wrapper>
  );
}

export default TraceAiSpans;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(300px, 400px) 1fr;
  grid-template-rows: 38px 1fr;
  flex: 1 1 100%;
  min-height: 0;
  background-color: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

const SpansHeader = styled('h6')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  margin-bottom: ${space(2)};
  margin-left: ${space(1)};
`;

const HeaderCell = styled('div')<{align?: 'left' | 'right'}>`
  padding: 0 ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  align-items: center;
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
`;

const LeftPanel = styled('div')`
  flex: 1;
  min-width: 300px;
  min-height: 0;
  padding: ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 400px;
`;

const RightPanel = styled('div')`
  min-width: 400px;
  padding-top: ${space(1)};
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
`;

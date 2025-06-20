import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/agentMonitoring/components/aiSpanList';
import {useAITrace} from 'sentry/views/insights/agentMonitoring/hooks/useAITrace';
import {useNodeDetailsLink} from 'sentry/views/insights/agentMonitoring/hooks/useNodeDetailsLink';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';
import {TraceTreeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

interface UseTraceViewDrawerProps {
  onClose?: () => void;
}

function getUniqueKey(node: AITraceSpanNode) {
  // types are not precise enough here. For AITraceSpanNode, event_id is always defined.
  return node.metadata.event_id as string;
}

function TraceViewDrawer({traceSlug}: {traceSlug: string}) {
  const {nodes, isLoading, error} = useAITrace(traceSlug);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const handleSelectNode = useCallback((node: AITraceSpanNode) => {
    const uniqueKey = getUniqueKey(node);
    setSelectedNodeKey(uniqueKey);
  }, []);

  useEffect(() => {
    if (nodes.length > 0 && !selectedNodeKey && nodes[0]) {
      handleSelectNode(nodes[0]);
    }
  }, [handleSelectNode, nodes, selectedNodeKey]);

  const selectedNode = selectedNodeKey
    ? nodes.find(node => getUniqueKey(node) === selectedNodeKey) || nodes[0]
    : nodes[0];

  const nodeDetailsLink = useNodeDetailsLink({
    node: selectedNode,
    traceSlug,
    source: TraceViewSources.AGENT_MONITORING,
  });

  return (
    <DrawerWrapper>
      <StyledDrawerHeader>
        <HeaderContent>
          {t('Abbreviated Trace')}
          <LinkButton size="xs" to={nodeDetailsLink}>
            {t('View in Full Trace')}
          </LinkButton>
        </HeaderContent>
      </StyledDrawerHeader>
      <StyledDrawerBody>
        <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
          <AITraceView
            traceSlug={traceSlug}
            nodes={nodes}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
            isLoading={isLoading}
            error={error}
          />
        </TraceStateProvider>
      </StyledDrawerBody>
    </DrawerWrapper>
  );
}

export function useTraceViewDrawer({onClose = undefined}: UseTraceViewDrawerProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();

  const openTraceViewDrawer = (traceSlug: string) =>
    openDrawer(() => <TraceViewDrawer traceSlug={traceSlug} />, {
      ariaLabel: t('Abbreviated Trace'),
      onClose,
      shouldCloseOnInteractOutside: () => true,
      drawerWidth: '40%',
      resizable: true,

      drawerKey: 'abbreviated-trace-view-drawer',
    });

  return {
    openTraceViewDrawer,
    isTraceViewDrawerOpen: isDrawerOpen,
  };
}

function AITraceView({
  traceSlug,
  nodes,
  selectedNode,
  onSelectNode,
  isLoading,
  error,
}: {
  error: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNode: AITraceSpanNode | undefined;
  traceSlug: string;
}) {
  const organization = useOrganization();
  if (isLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator size={32}>{t('Loading trace...')}</LoadingIndicator>
      </LoadingContainer>
    );
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found')}</EmptyMessage>;
  }

  if (error) {
    return <div>{t('Failed to load trace')}</div>;
  }

  return (
    <SplitContainer>
      <LeftPanel>
        <SpansHeader>{t('AI Spans')}</SpansHeader>
        <AISpanList
          nodes={nodes}
          selectedNodeKey={getUniqueKey(selectedNode!)}
          onSelectNode={onSelectNode}
        />
      </LeftPanel>
      <RightPanel>
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
      </RightPanel>
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
  flex: 1;
  min-height: 0;
  background-color: ${p => p.theme.background};
  overflow-y: auto;
  overflow-x: hidden;
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
  padding: ${space(1)} ${space(2)};
  display: flex;
`;

const HeaderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
`;

const SpansHeader = styled('h6')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: ${space(2)};
`;

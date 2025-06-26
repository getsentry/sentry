import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/agentMonitoring/components/aiSpanList';
import {useAITrace} from 'sentry/views/insights/agentMonitoring/hooks/useAITrace';
import {useNodeDetailsLink} from 'sentry/views/insights/agentMonitoring/hooks/useNodeDetailsLink';
import {useUrlTraceDrawer} from 'sentry/views/insights/agentMonitoring/hooks/useUrlTraceDrawer';
import {getDefaultSelectedNode} from 'sentry/views/insights/agentMonitoring/utils/getDefaultSelectedNode';
import {getNodeId} from 'sentry/views/insights/agentMonitoring/utils/getNodeId';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';
import {TraceTreeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

const LEFT_PANEL_WIDTH = 400;
const RIGHT_PANEL_WIDTH = 400;
const DRAWER_WIDTH = LEFT_PANEL_WIDTH + RIGHT_PANEL_WIDTH;

interface UseTraceViewDrawerProps {
  onClose?: () => void;
}

function TraceViewDrawer({
  traceSlug,
  closeDrawer,
}: {
  closeDrawer: () => void;
  traceSlug: string;
}) {
  const organization = useOrganization();
  const {nodes, isLoading, error} = useAITrace(traceSlug);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      const uniqueKey = getNodeId(node);
      setSelectedNodeKey(uniqueKey);

      trackAnalytics('agent-monitoring.drawer.span-select', {
        organization,
      });
    },
    [organization]
  );

  const selectedNode =
    (selectedNodeKey && nodes.find(node => getNodeId(node) === selectedNodeKey)) ||
    getDefaultSelectedNode(nodes);

  const nodeDetailsLink = useNodeDetailsLink({
    node: selectedNode,
    traceSlug,
    source: TraceViewSources.AGENT_MONITORING,
  });

  const handleViewFullTraceClick = useCallback(() => {
    trackAnalytics('agent-monitoring.drawer.view-full-trace-click', {
      organization,
    });
    closeDrawer();
  }, [organization, closeDrawer]);

  return (
    <DrawerWrapper>
      <StyledDrawerHeader>
        <HeaderContent>
          {t('Abbreviated Trace')}
          <LinkButton size="xs" onClick={handleViewFullTraceClick} to={nodeDetailsLink}>
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
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, drawerUrlState, closeDrawer} = useUrlTraceDrawer();

  const openTraceViewDrawer = useCallback(
    (traceSlug: string) => {
      trackAnalytics('agent-monitoring.drawer.open', {
        organization,
      });

      return openDrawer(
        () => <TraceViewDrawer traceSlug={traceSlug} closeDrawer={closeDrawer} />,
        {
          ariaLabel: t('Abbreviated Trace'),
          onClose,
          shouldCloseOnInteractOutside: () => true,
          drawerWidth: `${DRAWER_WIDTH}px`,
          resizable: true,
          traceSlug,
          drawerKey: 'abbreviated-trace-view-drawer',
        }
      );
    },
    [openDrawer, onClose, closeDrawer, organization]
  );

  useEffect(() => {
    if (drawerUrlState.trace && !isDrawerOpen) {
      openTraceViewDrawer(drawerUrlState.trace);
    }
  }, [drawerUrlState.trace, isDrawerOpen, openTraceViewDrawer]);

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
          selectedNodeKey={getNodeId(selectedNode!)}
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
  min-width: ${LEFT_PANEL_WIDTH}px;
  min-height: 0;
  padding: ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 400px;
`;

const RightPanel = styled('div')`
  min-width: ${RIGHT_PANEL_WIDTH}px;
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
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: bold;
  margin-bottom: ${space(2)};
`;

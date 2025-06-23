import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {AISpanList} from 'sentry/views/insights/agentMonitoring/components/aiSpanList';
import {useAITrace} from 'sentry/views/insights/agentMonitoring/hooks/useAITrace';
import {TraceTreeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

function TraceAiSpans({
  traceSlug,
}: {
  traceSlug: string;
  viewManager: VirtualizedViewManager;
}) {
  const organization = useOrganization();
  const {nodes, isLoading, error} = useAITrace(traceSlug);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const selectedNode = useMemo(() => {
    return nodes.find(node => node.metadata.event_id === selectedNodeKey) || nodes[0];
  }, [nodes, selectedNodeKey]);

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
      <HeaderCell>{/* TODO: tabs for spans */}</HeaderCell>
      <LeftPanel>
        <SpansHeader>{t('AI Spans')}</SpansHeader>
        <AISpanList
          nodes={nodes}
          onSelectNode={node => setSelectedNodeKey(node.metadata.event_id as string)}
          selectedNodeKey={selectedNode?.metadata.event_id ?? null}
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
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: ${space(2)};
  margin-left: ${space(1)};
`;

const HeaderCell = styled('div')`
  padding: 0 ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  align-items: center;
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

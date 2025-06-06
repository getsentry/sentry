import {Fragment, useEffect, useId, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconCode, IconSort} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_GENERATION_DESCRIPTIONS,
  AI_GENERATION_OPS,
  AI_RUN_DESCRIPTIONS,
  AI_RUN_OPS,
  AI_TOOL_CALL_OPS,
  mapMissingSpanOp,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {TraceTreeNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

interface UseTraceViewDrawerProps {
  onClose?: () => void;
}

interface UseCompleteTraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: TraceTreeNode[];
}

function useCompleteTrace(traceSlug: string): UseCompleteTraceResult {
  const [nodes, setNodes] = useState<Array<TraceTreeNode<TraceTree.NodeValue>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const api = useApi();
  const organization = useOrganization();
  const queryParams = useTraceQueryParams();

  const meta = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const trace = useTrace({traceSlug, timestamp: queryParams.timestamp});

  useEffect(() => {
    if (trace.status !== 'success' || !trace.data) {
      setError(trace.status === 'error');
      return;
    }

    const loadAllSpans = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const tree = TraceTree.FromTrace(trace.data, {
          meta: meta.data,
          replay: null,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        });

        tree.build();

        // Get all transaction nodes that can fetch spans
        const fetchableTransactionNodes = TraceTree.FindAll(tree.root, node => {
          return isTransactionNode(node) && node.canFetch;
        }).filter(
          (node): node is TraceTreeNode<TraceTree.Transaction> =>
            node.value !== null && isTransactionNode(node)
        );

        const dedupedFetchableTransactionNodes = fetchableTransactionNodes.filter(
          (node, index, self) =>
            index === self.findIndex(tx => tx.value.event_id === node.value.event_id)
        );

        // Zoom into all transactions to fetch their spans
        const zoomPromises = dedupedFetchableTransactionNodes.map(node =>
          tree.zoom(node, true, {
            api,
            organization,
            preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          })
        );

        await Promise.all(zoomPromises);

        // After all spans are loaded, get the complete node list
        const allSpanNodes = TraceTree.FindAll(tree.root, node => {
          return isSpanNode(node) || isEAPSpanNode(node);
        });

        const allTransactionNodes = TraceTree.FindAll(tree.root, node => {
          return isTransactionNode(node);
        }).filter(
          (node): node is TraceTreeNode<TraceTree.Transaction> =>
            node.value !== null && isTransactionNode(node)
        );

        setNodes([...allTransactionNodes, ...allSpanNodes]);
      } catch (err) {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllSpans();
  }, [trace.status, trace.data, meta.data, organization, api]);

  return {
    nodes,
    isLoading: trace.status === 'pending' || isLoading,
    error: trace.status === 'error' || error,
  };
}

export function useTraceViewDrawer({onClose = undefined}: UseTraceViewDrawerProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();

  const openTraceViewDrawer = (traceId: string, eventId: string, projectSlug: string) =>
    openDrawer(
      () => (
        <Fragment>
          <DrawerHeader>Abbreviated Trace</DrawerHeader>
          <DrawerBody>
            <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
              <AITraceView
                traceId={traceId}
                eventId={eventId}
                projectSlug={projectSlug}
              />
            </TraceStateProvider>
          </DrawerBody>
        </Fragment>
      ),
      {
        ariaLabel: t('Trace'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: '60%',
        resizable: true,
        drawerKey: 'abbreviated-trace-view-drawer',
      }
    );

  return {
    openTraceViewDrawer,
    isTraceViewDrawerOpen: isDrawerOpen,
  };
}

function AITraceView({
  traceId: traceSlug,
  eventId: _eventId,
  projectSlug: _projectSlug,
}: {
  eventId: string;
  projectSlug: string;
  traceId: string;
}) {
  const organization = useOrganization();
  const {nodes, isLoading, error} = useCompleteTrace(traceSlug);
  const [selectedNode, setSelectedNode] =
    useState<TraceTreeNode<TraceTree.NodeValue> | null>(null);

  if (isLoading || nodes.length === 0) {
    return <div>Loading complete trace...</div>;
  }

  if (error) {
    return <div>Error loading trace</div>;
  }

  return (
    <SplitContainer>
      <LeftPanel>
        <AbbreviatedTrace nodes={nodes} onSelectNode={setSelectedNode} />
      </LeftPanel>
      <RightPanel>
        <TraceTreeNodeDetails
          node={selectedNode ?? nodes[0]}
          manager={null}
          onParentClick={() => {}}
          onTabScrollToNode={() => {}}
          organization={organization}
          replay={null}
          traceId={traceSlug}
        />
      </RightPanel>
    </SplitContainer>
  );
}

function AbbreviatedTrace({
  nodes,
  onSelectNode,
}: {
  nodes: TraceTreeNode[];
  onSelectNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  const id = useId();
  const getKey = (node: TraceTreeNode<TraceTree.NodeValue>) => {
    if (isTransactionNode(node) || isEAPSpanNode(node)) {
      return node.value.event_id;
    }
    if (isSpanNode(node)) {
      return node.value.span_id;
    }

    return id;
  };

  return (
    <TraceListContainer>
      <h4>Abbreviated Trace</h4>
      {nodes.map(node => {
        return (
          <TraceListItem
            key={getKey(node)}
            node={node}
            onClick={() => onSelectNode(node)}
            isSelected={false}
          />
        );
      })}
    </TraceListContainer>
  );
}

function TraceListItem({
  node,
  onClick,
  isSelected,
}: {
  isSelected: boolean;
  node: TraceTreeNode<TraceTree.NodeValue>;
  onClick: () => void;
}) {
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(4);

  const getNodeInfo = () => {
    if (isTransactionNode(node)) {
      return {
        icon: <IconCode size="sm" />,
        title: node.value.transaction || 'Transaction',
        subtitle: node.value['transaction.op'] || '',
        color: colors[0],
      };
    }

    if (isSpanNode(node)) {
      const op = mapMissingSpanOp({
        op: node.value.op,
        description: node.value.description,
      });

      if (
        AI_RUN_OPS.includes(op) ||
        AI_RUN_DESCRIPTIONS.includes(node.value.description ?? '')
      ) {
        return {
          icon: <IconBot size="sm" />,
          title: 'ai.agent',
          subtitle: tryParseJson(node.value.data?.['ai.prompt'] ?? '{}').prompt || '',
          color: colors[1],
        };
      }

      if (
        AI_GENERATION_OPS.includes(op) ||
        AI_GENERATION_DESCRIPTIONS.includes(node.value.description ?? '')
      ) {
        return {
          icon: <IconSpeechBubble size="sm" />,
          title: 'ai.generate',
          subtitle: node.value.data?.['gen_ai.request.model'] || '',
          color: colors[2],
        };
      }
      if (AI_TOOL_CALL_OPS.includes(op)) {
        return {
          icon: <IconTool size="sm" />,
          title: node.value.description || 'Tool Call',
          subtitle: node.value.data?.['ai.toolCall.name'] || '',
          color: colors[3],
        };
      }
      if (node.value.op === 'http.client') {
        return {
          icon: <IconSort size="sm" />,
          title: node.value.description || 'HTTP',
          subtitle: node.value.data?.['http.url'] || '',
          color: colors[4],
        };
      }

      return {
        icon: <IconCode size="sm" />,
        title: node.value.op || 'Span',
        subtitle: node.value.description || '',
        color: colors[0],
      };
    }

    if (isEAPSpanNode(node)) {
      return {
        icon: <IconCode size="sm" />,
        title: node.value.op || 'EAP Span',
        subtitle: node.value.description || '',
        color: colors[0],
      };
    }

    return {
      icon: <IconCode size="sm" />,
      title: 'Unknown',
      subtitle: '',
      color: 'gray400',
    };
  };

  const {icon, title, subtitle, color} = getNodeInfo();

  return (
    <ListItemContainer isSelected={isSelected} onClick={onClick}>
      <ListItemIcon color={color}>{icon}</ListItemIcon>
      <ListItemContent>
        <ListItemHeader>
          <ListItemTitle>{title}</ListItemTitle>
          {subtitle && <ListItemSubtitle>- {subtitle}</ListItemSubtitle>}
        </ListItemHeader>
        <DurationBar color={color} />
      </ListItemContent>
    </ListItemContainer>
  );
}

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};
const SplitContainer = styled('div')`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

const LeftPanel = styled('div')`
  flex: 1;
  overflow: auto;
  min-width: 300px;

  border-right: 1px solid ${p => p.theme.border};
`;

const RightPanel = styled('div')`
  min-width: 400px;
  max-width: 600px;
  width: 50%;
  overflow: auto;
  background-color: ${p => p.theme.background};
`;

const TraceListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: ${space(2)};
  gap: ${space(0.5)};
  overflow: hidden;
`;

const ListItemContainer = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  background-color: ${p =>
    p.isSelected ? p.theme.backgroundSecondary : p.theme.background};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const ListItemIcon = styled('div')<{color: string}>`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
  color: ${p => p.color};
`;

const ListItemContent = styled('div')`
  flex: 1;
  min-width: 0;
`;

const ListItemHeader = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};
`;

const ListItemTitle = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const ListItemSubtitle = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`;

const DurationBar = styled('div')<{color: string}>`
  width: 100%;
  height: 4px;
  background-color: ${p => p.color};
  border-radius: 2px;
`;

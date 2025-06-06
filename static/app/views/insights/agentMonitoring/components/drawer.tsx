import {useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconCode, IconSort} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface UseTraceViewDrawerProps {
  onClose?: () => void;
}

interface UseCompleteTraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: Array<TraceTreeNode & {uniqueKey: string}>;
}

function useCompleteTrace(traceSlug: string): UseCompleteTraceResult {
  const [nodes, setNodes] = useState<
    Array<TraceTreeNode<TraceTree.NodeValue> & {uniqueKey: string}>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const api = useApi();
  const organization = useOrganization();
  const queryParams = useTraceQueryParams();

  const meta = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const trace = useTrace({traceSlug, timestamp: queryParams.timestamp});

  useEffect(() => {
    if (trace.status !== 'success' || !trace.data || !meta.data) {
      setError(trace.status === 'error' || meta.status === 'error');
      setIsLoading(trace.status === 'pending' || meta.status === 'pending' || !meta.data);
      return;
    }

    const loadAllSpans = async () => {
      setIsLoading(true);
      setError(false);
      setNodes([]);

      try {
        const tree = TraceTree.FromTrace(trace.data, {
          meta: meta.data,
          replay: null,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
        });

        tree.build();

        const fetchableTransactions = TraceTree.FindAll(tree.root, node => {
          return isTransactionNode(node) && node.canFetch && node.value !== null;
        }).filter((node): node is TraceTreeNode<TraceTree.Transaction> =>
          isTransactionNode(node)
        );

        const uniqueTransactions = fetchableTransactions.filter(
          (node, index, array) =>
            index === array.findIndex(tx => tx.value.event_id === node.value.event_id)
        );

        const zoomPromises = uniqueTransactions.map(node =>
          tree.zoom(node, true, {
            api,
            organization,
            preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          })
        );

        await Promise.all(zoomPromises);

        const flattenedNodes = TraceTree.FindAll(tree.root, node => {
          return isTransactionNode(node) || isSpanNode(node) || isEAPSpanNode(node);
        });

        const nodesWithKeys = flattenedNodes.map((node, index) => {
          let uniqueKey: string;
          if (isTransactionNode(node) || isEAPSpanNode(node)) {
            uniqueKey = node.value?.event_id || `unknown-${index}`;
          } else if (isSpanNode(node)) {
            uniqueKey = node.value?.span_id || `unknown-${index}`;
          } else {
            uniqueKey = `unknown-${index}`;
          }

          return Object.assign(node, {uniqueKey});
        });

        setNodes(nodesWithKeys);
        setIsLoading(false);
      } catch (err) {
        setError(true);
        setIsLoading(false);
      }
    };

    loadAllSpans();
  }, [trace.status, trace.data, meta.data, meta.status, organization, api]);

  return {
    nodes,
    isLoading,
    error,
  };
}

export function useTraceViewDrawer({onClose = undefined}: UseTraceViewDrawerProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();

  const openTraceViewDrawer = (traceId: string, eventId: string, projectSlug: string) =>
    openDrawer(
      () => (
        <DrawerWrapper>
          <StyledDrawerHeader>
            <HeaderContent>
              <div>AI Mode</div>
              <LinkButton
                size="xs"
                to={getTraceDetailsUrl({
                  eventId,
                  source: TraceViewSources.LLM_MODULE, // TODO: change source to AGENT_MONITORING
                  organization,
                  location,
                  traceSlug: traceId,
                  dateSelection: normalizeDateTimeParams(selection),
                })}
              >
                View Full Trace
              </LinkButton>
            </HeaderContent>
          </StyledDrawerHeader>
          <StyledDrawerBody>
            <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
              <AITraceView
                traceId={traceId}
                eventId={eventId}
                projectSlug={projectSlug}
              />
            </TraceStateProvider>
          </StyledDrawerBody>
        </DrawerWrapper>
      ),
      {
        ariaLabel: t('Abbreviated Trace'),
        onClose,
        shouldCloseOnInteractOutside: () => true,
        drawerWidth: '40%',
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
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length > 0 && !selectedNodeKey && nodes[0]) {
      setSelectedNodeKey(nodes[0].uniqueKey);
    }
  }, [nodes, selectedNodeKey]);

  if (isLoading || nodes.length === 0) {
    return (
      <LoadingContainer>
        <LoadingIndicator size={32}>Loading complete trace...</LoadingIndicator>
      </LoadingContainer>
    );
  }

  if (error) {
    return <div>Error loading trace</div>;
  }

  const selectedNode = selectedNodeKey
    ? nodes.find(node => node.uniqueKey === selectedNodeKey) || nodes[0]
    : nodes[0];

  return (
    <SplitContainer>
      <LeftPanel>
        <h4>Abbreviated Trace</h4>

        <AbbreviatedTrace
          nodes={nodes}
          selectedNodeKey={selectedNodeKey}
          onSelectNode={setSelectedNodeKey}
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
        />
      </RightPanel>
    </SplitContainer>
  );
}

function AbbreviatedTrace({
  nodes,
  selectedNodeKey,
  onSelectNode,
}: {
  nodes: Array<TraceTreeNode & {uniqueKey: string}>;
  onSelectNode: (key: string) => void;
  selectedNodeKey: string | null;
}) {
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(5);

  const traceBounds = useMemo((): {
    duration: number;
    endTime: number;
    startTime: number;
  } => {
    if (nodes.length === 0) return {startTime: 0, endTime: 0, duration: 0};

    const rootNode = nodes.find(node => isTransactionNode(node));
    if (!rootNode?.value) return {startTime: 0, endTime: 0, duration: 0};

    const startTime = rootNode.value.start_timestamp;
    const endTime = rootNode.value.timestamp;

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }, [nodes]);

  return (
    <TraceListContainer>
      {nodes.map(node => {
        return (
          <TraceListItem
            key={node.uniqueKey}
            node={node}
            traceBounds={traceBounds}
            onClick={() => onSelectNode(node.uniqueKey)}
            isSelected={node.uniqueKey === selectedNodeKey}
            colors={colors}
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
  traceBounds,
  colors,
}: {
  colors: readonly string[];
  isSelected: boolean;
  node: TraceTreeNode<TraceTree.NodeValue> & {uniqueKey: string};
  onClick: () => void;
  traceBounds: {duration: number; endTime: number; startTime: number};
}) {
  const {icon, title, subtitle, color} = getNodeInfo(node, colors);

  const safeColor = color || colors[0] || '#9ca3af';

  const relativeTiming = calculateRelativeTiming(node, traceBounds);

  return (
    <ListItemContainer isSelected={isSelected} onClick={onClick}>
      <ListItemIcon color={safeColor}>{icon}</ListItemIcon>
      <ListItemContent>
        <ListItemHeader>
          <ListItemTitle>{title}</ListItemTitle>
          {subtitle && <ListItemSubtitle>- {subtitle}</ListItemSubtitle>}
        </ListItemHeader>
        <DurationBar color={safeColor} relativeTiming={relativeTiming} />
      </ListItemContent>
    </ListItemContainer>
  );
}

interface TraceBounds {
  duration: number;
  endTime: number;
  startTime: number;
}

function calculateRelativeTiming(
  node: TraceTreeNode<TraceTree.NodeValue>,
  traceBounds: TraceBounds
): {leftPercent: number; widthPercent: number} {
  if (!node.value) return {leftPercent: 0, widthPercent: 0};

  let startTime: number, endTime: number;

  if (isTransactionNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.timestamp;
  } else if (isSpanNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.timestamp;
  } else if (isEAPSpanNode(node)) {
    startTime = node.value.start_timestamp;
    endTime = node.value.end_timestamp;
  } else {
    return {leftPercent: 0, widthPercent: 0};
  }

  if (traceBounds.duration === 0) return {leftPercent: 0, widthPercent: 0};

  const relativeStart =
    Math.max(0, (startTime - traceBounds.startTime) / traceBounds.duration) * 100;
  const spanDuration = ((endTime - startTime) / traceBounds.duration) * 100;

  // Minimum width of 2% for very short spans
  const minWidth = 2;
  const adjustedWidth = Math.max(spanDuration, minWidth);

  const maxAllowedStart = 100 - adjustedWidth;
  const adjustedStart = Math.min(relativeStart, maxAllowedStart);

  return {leftPercent: adjustedStart, widthPercent: adjustedWidth};
}

function getNodeInfo(
  node: TraceTreeNode<TraceTree.NodeValue>,
  colors: readonly string[]
) {
  // Default return value
  const nodeInfo = {
    icon: <IconCode size="md" />,
    title: 'Unknown',
    subtitle: '',
    color: colors[0],
  };

  if (isTransactionNode(node)) {
    nodeInfo.title = node.value.transaction || 'Transaction';
    nodeInfo.subtitle = node.value['transaction.op'] || '';
    return nodeInfo;
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
      nodeInfo.icon = <IconBot size="md" />;
      nodeInfo.title = 'ai.agent';
      nodeInfo.subtitle =
        tryParseJson(node.value.data?.['ai.prompt'] ?? '{}').prompt || '';
      nodeInfo.color = colors[1];
    } else if (
      AI_GENERATION_OPS.includes(op) ||
      AI_GENERATION_DESCRIPTIONS.includes(node.value.description ?? '')
    ) {
      nodeInfo.icon = <IconSpeechBubble size="md" />;
      nodeInfo.title = 'ai.generate';
      nodeInfo.subtitle = node.value.data?.['gen_ai.request.model'] || '';
      nodeInfo.color = colors[2];
    } else if (AI_TOOL_CALL_OPS.includes(op)) {
      nodeInfo.icon = <IconTool size="md" />;
      nodeInfo.title = node.value.description || 'Tool Call';
      nodeInfo.subtitle = node.value.data?.['ai.toolCall.name'] || '';
      nodeInfo.color = colors[3];
    } else if (node.value.op === 'http.client') {
      nodeInfo.icon = <IconSort size="md" />;
      nodeInfo.title = node.value.description || 'HTTP';
      nodeInfo.subtitle = node.value.data?.['http.url'] || '';
      nodeInfo.color = colors[4];
    } else {
      nodeInfo.title = node.value.op || 'Span';
      nodeInfo.subtitle = node.value.description || '';
    }
    return nodeInfo;
  }

  if (isEAPSpanNode(node)) {
    nodeInfo.title = node.value.op || 'EAP Span';
    nodeInfo.subtitle = node.value.description || '';
    return nodeInfo;
  }

  return nodeInfo;
}

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

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
`;

const RightPanel = styled('div')`
  min-width: 400px;
  max-width: 600px;
  width: 50%;
  min-height: 0;
  background-color: ${p => p.theme.background};
  overflow-y: auto;
  overflow-x: hidden;
`;

const TraceListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: ${space(0.25)};
  overflow: hidden;
`;

const ListItemContainer = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  background-color: ${p =>
    p.isSelected ? p.theme.backgroundSecondary : p.theme.background};
  outline: ${p => (p.isSelected ? `2px solid ${p.theme.purple200}` : 'none')};

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

const DurationBar = styled('div')<{
  color: string;
  relativeTiming: {leftPercent: number; widthPercent: number};
}>`
  width: 100%;
  height: 4px;
  background-color: ${p => p.theme.gray200};
  border-radius: 2px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: ${p => p.relativeTiming.leftPercent}%;
    top: 0;
    height: 100%;
    width: ${p => p.relativeTiming.widthPercent}%;
    background-color: ${p => p.color};
    border-radius: 2px;
  }
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
`;

const HeaderContent = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  h3 {
    margin: 0;
    font-size: ${p => p.theme.fontSizeLarge};
    font-weight: 600;
  }
`;

import {useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import {IconCode, IconSort} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconSpeechBubble} from 'sentry/icons/iconSpeechBubble';
import {IconTool} from 'sentry/icons/iconTool';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  AI_AGENT_NAME_ATTRIBUTE,
  AI_GENERATION_DESCRIPTIONS,
  AI_GENERATION_OPS,
  AI_MODEL_ID_ATTRIBUTE,
  AI_RUN_DESCRIPTIONS,
  AI_RUN_OPS,
  AI_TOOL_CALL_DESCRIPTIONS,
  AI_TOOL_CALL_OPS,
  AI_TOOL_NAME_ATTRIBUTE,
  AI_TOTAL_TOKENS_ATTRIBUTE,
  mapMissingSpanOp,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {EAPSpanProperty} from 'sentry/views/insights/types';
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
type TraceSpanNode = TraceTreeNode<
  TraceTree.Transaction | TraceTree.EAPSpan | TraceTree.Span
>;

interface UseCompleteTraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: TraceSpanNode[];
}

function getUniqueKey(node: TraceSpanNode, index: number) {
  let uniqueKey: string;
  if (isTransactionNode(node) || isEAPSpanNode(node)) {
    uniqueKey = node.value?.event_id || `unknown-${index}`;
  } else if (isSpanNode(node)) {
    uniqueKey = node.value?.span_id || `unknown-${index}`;
  } else {
    uniqueKey = `unknown-${index}`;
  }

  return uniqueKey;
}

function useCompleteTrace(traceSlug: string): UseCompleteTraceResult {
  const [nodes, setNodes] = useState<TraceSpanNode[]>([]);
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
        }) as TraceSpanNode[];

        setNodes(flattenedNodes);
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

  const openTraceViewDrawer = (traceId: string) =>
    openDrawer(
      () => (
        <DrawerWrapper>
          <StyledDrawerHeader>
            <HeaderContent>
              <div>AI Mode</div>
              <LinkButton
                size="xs"
                to={getTraceDetailsUrl({
                  source: TraceViewSources.AGENT_MONITORING,
                  organization,
                  location,
                  traceSlug: traceId,
                  dateSelection: normalizeDateTimeParams(selection),
                })}
              >
                {t('View Full Trace')}
              </LinkButton>
            </HeaderContent>
          </StyledDrawerHeader>
          <StyledDrawerBody>
            <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
              <AITraceView traceId={traceId} />
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

function AITraceView({traceId: traceSlug}: {traceId: string}) {
  const organization = useOrganization();
  const {nodes, isLoading, error} = useCompleteTrace(traceSlug);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length > 0 && !selectedNodeKey && nodes[0]) {
      setSelectedNodeKey(getUniqueKey(nodes[0], 0));
    }
  }, [nodes, selectedNodeKey]);

  if (isLoading || nodes.length === 0) {
    return (
      <LoadingContainer>
        <LoadingIndicator size={32}>{t('Loading trace...')}</LoadingIndicator>
      </LoadingContainer>
    );
  }

  if (error) {
    return <div>{t('Failed to load trace')}</div>;
  }

  const selectedNode = selectedNodeKey
    ? nodes.find((node, index) => getUniqueKey(node, index) === selectedNodeKey) ||
      nodes[0]
    : nodes[0];

  return (
    <SplitContainer>
      <LeftPanel>
        <h4>{t('Abbreviated Trace')}</h4>

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
          hideNodeActions
        />
      </RightPanel>
    </SplitContainer>
  );
}

const TAGS_REGEX = /tags\[(.*?),.*\]/;
function mapSpanAttributes(
  spanAttributes: Record<string, string | number | boolean | null>
) {
  // Map "tags[gen_ai.request.model,string]" to "gen_ai.request.model"
  return Object.fromEntries(
    Object.entries(spanAttributes)
      .map<[string, string | undefined]>(([key, value]) => {
        const match = key.match(TAGS_REGEX);
        if (match?.[1]) {
          return [match[1], value?.toString()];
        }
        return [key, value?.toString()];
      })
      .filter((entry): entry is [string, string] => defined(entry[1]))
  );
}

const keyToTag = (key: string, type: 'string' | 'number') => {
  return `tags[${key},${type}]`;
};

function useEAPSpanAttributes(nodes: Array<TraceTreeNode<TraceTree.NodeValue>>) {
  const spans = useMemo(() => {
    return nodes.filter(node => isEAPSpanNode(node));
  }, [nodes]);
  const spanAttributesRequest = useEAPSpans(
    {
      search: `span_id:[${spans.map(span => span.value.event_id).join(',')}]`,
      fields: [
        'span_id',
        keyToTag(AI_MODEL_ID_ATTRIBUTE, 'string'),
        keyToTag(AI_TOTAL_TOKENS_ATTRIBUTE, 'number'),
        keyToTag(AI_TOOL_NAME_ATTRIBUTE, 'string'),
        keyToTag(AI_AGENT_NAME_ATTRIBUTE, 'string'),
      ] as EAPSpanProperty[],
      limit: 100,
    },
    Referrer.TRACE_DRAWER
  );

  const spanAttributes = useMemo(() => {
    return spanAttributesRequest.data?.reduce(
      (acc, span) => {
        acc[span.span_id] = mapSpanAttributes(span);
        return acc;
      },
      {} as Record<string, Record<string, string>>
    );
  }, [spanAttributesRequest.data]);

  return {data: spanAttributes, isPending: spanAttributesRequest.isPending};
}

function AbbreviatedTrace({
  nodes,
  selectedNodeKey,
  onSelectNode,
}: {
  nodes: TraceSpanNode[];
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

    const rootNode = nodes.find(
      (node): node is TraceTreeNode<TraceTree.Transaction | TraceTree.EAPSpan> =>
        isTransactionNode(node) || (isEAPSpanNode(node) && node.value.is_transaction)
    );
    if (!rootNode?.value) return {startTime: 0, endTime: 0, duration: 0};

    const startTime = rootNode.value.start_timestamp;
    let endTime = 0;
    if (isTransactionNode(rootNode)) {
      endTime = rootNode.value.timestamp;
    } else if (isEAPSpanNode(rootNode)) {
      endTime = rootNode.value.end_timestamp;
    }

    if (endTime === 0) return {startTime: 0, endTime: 0, duration: 0};

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }, [nodes]);

  const spanAttributesRequest = useEAPSpanAttributes(nodes);

  return (
    <TraceListContainer>
      {nodes.map((node, index) => {
        const uniqueKey = getUniqueKey(node, index);
        return (
          <TraceListItem
            key={uniqueKey}
            node={node}
            traceBounds={traceBounds}
            onClick={() => onSelectNode(uniqueKey)}
            isSelected={uniqueKey === selectedNodeKey}
            colors={colors}
            isLoadingAttributes={
              isEAPSpanNode(node) ? spanAttributesRequest.isPending : false
            }
            spanAttributes={
              isEAPSpanNode(node)
                ? spanAttributesRequest.data[node.value.event_id]
                : undefined
            }
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
  spanAttributes = {},
  isLoadingAttributes = false,
}: {
  colors: readonly string[];
  isSelected: boolean;
  node: TraceSpanNode;
  onClick: () => void;
  spanAttributes: Record<string, string> | undefined;
  traceBounds: {duration: number; endTime: number; startTime: number};
  isLoadingAttributes?: boolean;
}) {
  const {icon, title, subtitle, color} = getNodeInfo(node, colors, spanAttributes);

  const safeColor = color || colors[0] || '#9ca3af';

  const relativeTiming = calculateRelativeTiming(node, traceBounds);

  return (
    <ListItemContainer isSelected={isSelected} onClick={onClick}>
      <ListItemIcon color={safeColor}>{icon}</ListItemIcon>
      <ListItemContent>
        <ListItemHeader>
          <ListItemTitle>{title}</ListItemTitle>
          {isLoadingAttributes ? (
            <Placeholder height="12px" width="60px" />
          ) : (
            subtitle && <ListItemSubtitle>- {subtitle}</ListItemSubtitle>
          )}
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
  node: TraceSpanNode,
  colors: readonly string[],
  spanAttributes: Record<string, string>
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

  if (!isEAPSpanNode(node) && !isSpanNode(node)) {
    return nodeInfo;
  }

  const getNodeAttribute = (key: string) => {
    if (isEAPSpanNode(node)) {
      return spanAttributes?.[key];
    }

    return node.value?.data?.[key];
  };

  const op = mapMissingSpanOp({
    op: node.value?.op,
    description: node.value?.description,
  });

  if (
    AI_RUN_OPS.includes(op) ||
    AI_RUN_DESCRIPTIONS.includes(node.value.description ?? '')
  ) {
    const agentName = getNodeAttribute(AI_AGENT_NAME_ATTRIBUTE) || '';
    const model = getNodeAttribute(AI_MODEL_ID_ATTRIBUTE) || '';
    nodeInfo.icon = <IconBot size="md" />;
    nodeInfo.title = op;
    nodeInfo.subtitle = `${agentName} (${model})`;
    nodeInfo.color = colors[1];
  } else if (
    AI_GENERATION_OPS.includes(op) ||
    AI_GENERATION_DESCRIPTIONS.includes(node.value.description ?? '')
  ) {
    const tokens = getNodeAttribute(AI_TOTAL_TOKENS_ATTRIBUTE);
    nodeInfo.icon = <IconSpeechBubble size="md" />;
    nodeInfo.title = op;
    nodeInfo.subtitle = tokens ? ` ${tokens} Tokens` : '';
    nodeInfo.color = colors[2];
  } else if (
    AI_TOOL_CALL_OPS.includes(op) ||
    AI_TOOL_CALL_DESCRIPTIONS.includes(node.value.description ?? '')
  ) {
    nodeInfo.icon = <IconTool size="md" />;
    nodeInfo.title = op || 'gen_ai.toolCall';
    nodeInfo.subtitle = getNodeAttribute(AI_TOOL_NAME_ATTRIBUTE) || '';
    nodeInfo.color = colors[3];
  } else if (op === 'http.client') {
    nodeInfo.icon = <IconSort size="md" />;
    nodeInfo.title = node.value.description || 'HTTP';
    nodeInfo.color = colors[4];
  } else {
    nodeInfo.title = op || 'Span';
    nodeInfo.subtitle = node.value.description || '';
  }
  return nodeInfo;
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

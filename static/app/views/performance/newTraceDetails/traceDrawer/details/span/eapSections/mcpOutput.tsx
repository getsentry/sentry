import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {getIsMCPNode} from 'sentry/views/insights/mcp/utils/mcpTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

const OUTPUT_ATTRIBUTE = 'mcp.tool.result.content';

function getOutputValue(
  node: TraceTreeNode<TraceTree.NodeValue>,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
): string | undefined {
  if (isEAPSpanNode(node) && attributes) {
    return attributes
      .find(attribute => attribute.name === OUTPUT_ATTRIBUTE)
      ?.value.toString();
  }

  if (isTransactionNode(node) && event?.contexts.trace?.data) {
    return event.contexts.trace.data[OUTPUT_ATTRIBUTE]?.toString();
  }

  if (isSpanNode(node) && node.value.data) {
    return node.value.data[OUTPUT_ATTRIBUTE]?.toString();
  }

  return undefined;
}

export function MCPOutputSection({
  node,
  attributes,
  event,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  const organization = useOrganization();
  if (!hasMCPInsightsFeature(organization) && getIsMCPNode(node)) {
    return null;
  }

  const outputValue = getOutputValue(node, event, attributes);

  if (!outputValue) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.MCP_OUTPUT}
      title={t('Output')}
      disableCollapsePersistence
    >
      <TraceDrawerComponents.MultilineJSON value={outputValue} maxDefaultDepth={2} />
    </FoldSection>
  );
}

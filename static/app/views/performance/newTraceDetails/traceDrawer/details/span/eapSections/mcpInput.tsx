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

const ARGUMENTS_KEY_PREFIX = 'mcp.request.argument.';

function isArgumentsKey(key: string) {
  return key.startsWith(ARGUMENTS_KEY_PREFIX);
}
function shortenKey(key: string) {
  return key.replace(ARGUMENTS_KEY_PREFIX, '');
}

function getInputAttributes(
  node: TraceTreeNode<TraceTree.NodeValue>,
  event?: EventTransaction,
  attributes?: TraceItemResponseAttribute[]
): Array<[string, string]> {
  if (isEAPSpanNode(node) && attributes) {
    return attributes
      .filter(attribute => isArgumentsKey(attribute.name))
      .map(attribute => [shortenKey(attribute.name), attribute.value.toString()]);
  }

  if (isTransactionNode(node) && event?.contexts.trace?.data) {
    return Object.entries(event.contexts.trace.data)
      .filter(([key]) => isArgumentsKey(key))
      .map(([key, value]) => [shortenKey(key), value]);
  }

  if (isSpanNode(node) && node.value.data) {
    return Object.entries(node.value.data)
      .filter(([key]) => isArgumentsKey(key))
      .map(([key, value]) => [shortenKey(key), value]);
  }

  return [];
}

export function MCPInputSection({
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

  const inputAttributes = getInputAttributes(node, event, attributes);

  if (!inputAttributes.length) {
    return null;
  }

  const inputAttributesObject = Object.fromEntries(inputAttributes);

  return (
    <FoldSection
      sectionKey={SectionKey.MCP_INPUT}
      title={t('Input')}
      disableCollapsePersistence
    >
      <TraceDrawerComponents.MultilineJSON
        value={inputAttributesObject}
        maxDefaultDepth={1}
      />
    </FoldSection>
  );
}

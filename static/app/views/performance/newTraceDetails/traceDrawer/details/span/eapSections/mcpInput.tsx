import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {ensureAttributeObject} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getIsMCPNode} from 'sentry/views/insights/pages/mcp/utils/mcpTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
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
): Array<[string, string | number | boolean]> {
  const attributeObject = ensureAttributeObject(node, event, attributes);

  if (!attributeObject) {
    return [];
  }

  return Object.entries(attributeObject)
    .filter(([key]) => isArgumentsKey(key))
    .map(([key, value]) => [shortenKey(key), value]);
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
  if (!getIsMCPNode(node)) {
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

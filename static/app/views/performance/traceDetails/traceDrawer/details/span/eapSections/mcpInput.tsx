import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getIsMCPNode} from 'sentry/views/insights/pages/mcp/utils/mcpTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {getAIToolInput} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiInput';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';

export function MCPInputSection({
  node,
  attributes,
  event,
}: {
  node: EapSpanNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  if (!getIsMCPNode(node)) {
    return null;
  }

  const input = getAIToolInput(node, attributes, event);

  if (input === undefined) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.MCP_INPUT}
      title={t('Input')}
      disableCollapsePersistence
    >
      <TraceDrawerComponents.MultilineJSON value={input} maxDefaultDepth={1} />
    </FoldSection>
  );
}

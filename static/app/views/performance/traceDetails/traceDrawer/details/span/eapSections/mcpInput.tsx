import {CodeModeDetails} from 'sentry/components/ai/toolDetails/codeModeDetails';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getCodeModeInput,
  isCodeModeNode,
} from 'sentry/views/insights/pages/agents/utils/codeMode';
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
  // Legacy MCP fields contain separately JSON-encoded values, not complete tool input.
  const codeInput = isCodeModeNode(node, attributes)
    ? getCodeModeInput(
        getTraceNodeAttribute('gen_ai.tool.call.arguments', node, event, attributes) ??
          getTraceNodeAttribute('gen_ai.tool.input', node, event, attributes)
      )
    : null;

  return (
    <FoldSection
      sectionKey={SectionKey.MCP_INPUT}
      title={t('Input')}
      disableCollapsePersistence
    >
      {codeInput ? (
        <CodeModeDetails key={node.id} projectId={node.value.project_id} {...codeInput} />
      ) : (
        <TraceDrawerComponents.MultilineJSON value={input} maxDefaultDepth={1} />
      )}
    </FoldSection>
  );
}

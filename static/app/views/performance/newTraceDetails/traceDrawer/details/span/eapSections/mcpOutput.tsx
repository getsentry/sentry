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

const TOOL_OUTPUT_ATTRIBUTE = 'mcp.tool.result.content';
const PROMPT_OUTPUT_PREFIX = 'mcp.prompt.result.';

export function MCPOutputSection({
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
  const attributeDict = ensureAttributeObject(node, event, attributes);

  if (!attributeDict) {
    return null;
  }

  const toolOutput = attributeDict[TOOL_OUTPUT_ATTRIBUTE];
  const promptOutputDict = Object.entries(attributeDict)
    .filter(([key]) => key.startsWith(PROMPT_OUTPUT_PREFIX))
    .reduce(
      (acc, [key, value]) => {
        acc[key.replace(PROMPT_OUTPUT_PREFIX, '')] = value;
        return acc;
      },
      {} as Record<string, string | number | boolean>
    );
  const hasPromptOutput = Object.keys(promptOutputDict).length > 0;

  if (!toolOutput && !hasPromptOutput) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.MCP_OUTPUT}
      title={t('Output')}
      disableCollapsePersistence
    >
      {toolOutput ? (
        <TraceDrawerComponents.MultilineJSON value={toolOutput} maxDefaultDepth={2} />
      ) : null}
      {hasPromptOutput ? (
        <TraceDrawerComponents.MultilineJSON
          value={promptOutputDict}
          maxDefaultDepth={2}
        />
      ) : null}
    </FoldSection>
  );
}

import {Fragment} from 'react';

import {ToolOutput} from 'sentry/components/ai/toolDetails/toolOutput';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {isRecord} from 'sentry/utils/object/isRecord';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {extractAssistantOutput} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  ensureAttributeObject,
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getLegacyMCPToolResult} from 'sentry/views/insights/pages/mcp/utils/mcpContent';
import {getIsMCPNode} from 'sentry/views/insights/pages/mcp/utils/mcpTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {AIContentRenderer} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';

interface AIOutputData {
  reasoningText: string | null;
  responseObject: string | null;
  responseText: string | null;
  toolCalls: string | null;
}

const OUTPUT_ATTRIBUTES = ['gen_ai.output.messages', 'gen_ai.response.text'] as const;

const OUTPUT_PRESENCE_ATTRIBUTES = [
  ...OUTPUT_ATTRIBUTES,
  'gen_ai.response.object',
  'gen_ai.response.tool_calls',
  'gen_ai.tool.call.result',
  'gen_ai.tool.output',
] as const;

export function AIOutputSection({
  node,
  attributes,
  event,
  initialCollapse,
}: {
  node: EapSpanNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
  initialCollapse?: boolean;
}) {
  if (
    getIsMCPNode(node) ||
    !getIsAiNode(node) ||
    !hasAIOutputAttribute(node, attributes, event)
  ) {
    return null;
  }

  const {reasoningText, responseText, responseObject, toolCalls} = getAIOutputData(
    node,
    attributes,
    event
  );
  const toolOutput = getAIToolOutput(node, attributes, event);
  const hasToolOutput = toolOutput !== undefined;

  if (
    !reasoningText &&
    !responseText &&
    !responseObject &&
    !toolCalls &&
    !hasToolOutput
  ) {
    return null;
  }

  return (
    <FoldSection
      key={node.id}
      sectionKey={SectionKey.AI_OUTPUT}
      title={t('Output')}
      disableCollapsePersistence
      initialCollapse={initialCollapse}
    >
      {reasoningText && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Thinking')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer text={reasoningText} />
        </Fragment>
      )}
      {responseText && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer text={responseText} />
        </Fragment>
      )}
      {responseObject && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          <AIContentRenderer text={responseObject} />
        </Fragment>
      )}
      {toolCalls && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Tool Calls')}
          </TraceDrawerComponents.MultilineTextLabel>
          <TraceDrawerComponents.MultilineJSON value={toolCalls} maxDefaultDepth={2} />
        </Fragment>
      )}
      {hasToolOutput ? <ToolOutput value={toolOutput} /> : null}
    </FoldSection>
  );
}

export function hasAIOutputAttribute(
  node: EapSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
    OUTPUT_PRESENCE_ATTRIBUTES.some(
      key => getTraceNodeAttribute(key, node, event, attributes) !== undefined
    ) ||
    (getIsMCPNode(node) && getAIToolOutput(node, attributes, event) !== undefined)
  );
}

/**
 * Gets AI output data, checking attributes in priority order:
 * `gen_ai.output.messages` > `gen_ai.response.text`.
 *
 * Every attribute runs through the same normalizer, so any supported shape
 * (parts, content, {messages: ...}, plain string) works on any attribute.
 * When neither structured attribute yields data, the dedicated
 * `gen_ai.response.object` / `gen_ai.response.tool_calls` fields are used as
 * supplementary fallbacks.
 */
export function getAIOutputData(
  node: EapSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): AIOutputData {
  for (const key of OUTPUT_ATTRIBUTES) {
    const raw = getTraceNodeAttribute(key, node, event, attributes);
    if (!raw) {
      continue;
    }
    const extracted = extractAssistantOutput(raw.toString(), {
      defaultRole: 'assistant',
    });
    if (
      extracted.reasoningText ||
      extracted.responseText ||
      extracted.responseObject ||
      extracted.toolCalls
    ) {
      return {
        reasoningText: extracted.reasoningText,
        responseText: extracted.responseText,
        responseObject: extracted.responseObject,
        toolCalls: extracted.toolCalls,
      };
    }
  }

  const responseObject = getTraceNodeAttribute(
    'gen_ai.response.object',
    node,
    event,
    attributes
  );
  const toolCalls = getTraceNodeAttribute(
    'gen_ai.response.tool_calls',
    node,
    event,
    attributes
  );

  return {
    reasoningText: null,
    responseText: null,
    responseObject: responseObject?.toString() ?? null,
    toolCalls: toolCalls?.toString() ?? null,
  };
}

export function getAIToolOutput(
  node: EapSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  const result = getTraceNodeAttribute(
    'gen_ai.tool.call.result',
    node,
    event,
    attributes
  );
  if (result === undefined || result === null) {
    return (
      getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes) ??
      (getIsMCPNode(node)
        ? getLegacyMCPToolResult(ensureAttributeObject(node, event, attributes))
        : undefined)
    );
  }

  let parsed: unknown = result;
  if (typeof result === 'string') {
    try {
      parsed = JSON.parse(result);
    } catch {
      return result;
    }
  }

  if (isRecord(parsed) && 'input' in parsed && 'output' in parsed) {
    // Serialize even scalar outputs so false, 0, null, and empty strings remain visible.
    return JSON.stringify(parsed.output);
  }
  return result;
}

import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {extractAssistantOutput} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
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
  'anthropic.tool_result.content',
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
  if (!getIsAiNode(node) || !hasAIOutputAttribute(node, attributes, event)) {
    return null;
  }

  const {reasoningText, responseText, responseObject, toolCalls} = getAIOutputData(
    node,
    attributes,
    event
  );
  const toolOutput = getAIToolOutput(node, attributes, event);

  if (!reasoningText && !responseText && !responseObject && !toolCalls && !toolOutput) {
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
      {toolOutput ? (
        <AIContentRenderer text={formatAIToolOutput(toolOutput)} maxJsonDepth={1} />
      ) : null}
    </FoldSection>
  );
}

export function hasAIOutputAttribute(
  node: EapSpanNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return OUTPUT_PRESENCE_ATTRIBUTES.some(key =>
    getTraceNodeAttribute(key, node, event, attributes)
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
  return (
    getTraceNodeAttribute('gen_ai.tool.call.result', node, event, attributes) ??
    getTraceNodeAttribute('anthropic.tool_result.content', node, event, attributes) ??
    getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes)
  );
}

/**
 * Content-block arrays can be rendered as text using the existing message
 * normalizer. Keep the original JSON if any block is unsupported, rather than
 * dropping part of a tool's result.
 */
export function formatAIToolOutput(output: string | number | boolean): string {
  const raw = output.toString();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return raw;
  }
  const texts: string[] = [];
  for (const block of parsed) {
    const {responseText} = extractAssistantOutput(
      JSON.stringify({role: 'assistant', content: [block]}),
      {defaultRole: 'assistant'}
    );
    if (!responseText) {
      return raw;
    }
    texts.push(responseText);
  }
  return texts.join('\n');
}

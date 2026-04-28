import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {extractAssistantOutput} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

interface AIOutputData {
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
  node: EapSpanNode | SpanNode | TransactionNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
  initialCollapse?: boolean;
}) {
  if (!getIsAiNode(node) || !hasAIOutputAttribute(node, attributes, event)) {
    return null;
  }

  const {responseText, responseObject, toolCalls} = getAIOutputData(
    node,
    attributes,
    event
  );
  const toolOutput = getAIToolOutput(node, attributes, event);

  if (!responseText && !responseObject && !toolCalls && !toolOutput) {
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
        <TraceDrawerComponents.MultilineJSON value={toolOutput} maxDefaultDepth={1} />
      ) : null}
    </FoldSection>
  );
}

export function hasAIOutputAttribute(
  node: EapSpanNode | SpanNode | TransactionNode,
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
function getAIOutputData(
  node: EapSpanNode | SpanNode | TransactionNode,
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
    if (extracted.responseText || extracted.responseObject || extracted.toolCalls) {
      return {
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
    responseText: null,
    responseObject: responseObject?.toString() ?? null,
    toolCalls: toolCalls?.toString() ?? null,
  };
}

function getAIToolOutput(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
    getTraceNodeAttribute('gen_ai.tool.call.result', node, event, attributes) ??
    getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes)
  );
}

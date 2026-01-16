import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

function isJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    return false;
  }
}

function renderAIResponse(text: string) {
  return isJson(text) ? (
    <TraceDrawerComponents.MultilineJSON value={text} maxDefaultDepth={2} />
  ) : (
    <TraceDrawerComponents.MultilineText>{text}</TraceDrawerComponents.MultilineText>
  );
}

interface AIOutputData {
  responseObject: string | null;
  responseText: string | null;
  toolCalls: string | null;
}

/**
 * Extracts content from the new parts-based format.
 * Handles text parts, tool calls, and structured objects.
 */
function extractFromOutputMessages(outputMessages: string): AIOutputData {
  const result: AIOutputData = {
    responseText: null,
    responseObject: null,
    toolCalls: null,
  };

  try {
    const parsed = JSON.parse(outputMessages);
    if (!Array.isArray(parsed)) {
      return result;
    }

    const textParts: string[] = [];
    const toolCallParts: any[] = [];
    const objectParts: any[] = [];

    for (const msg of parsed) {
      if (msg.role !== 'assistant') {
        continue;
      }

      if (!msg.parts || !Array.isArray(msg.parts)) {
        // Old format - extract content directly
        if (msg.content) {
          if (typeof msg.content === 'string') {
            textParts.push(msg.content);
          } else if (typeof msg.content === 'object') {
            objectParts.push(msg.content);
          }
        }
        continue;
      }

      // New parts-based format
      for (const part of msg.parts) {
        if (part.type === 'text' && (part.content || part.text)) {
          textParts.push(part.content || part.text);
        } else if (part.type === 'tool_call') {
          toolCallParts.push(part);
        } else if (part.type === 'object') {
          objectParts.push(part);
        }
      }
    }

    if (textParts.length > 0) {
      result.responseText = textParts.join('\n');
    }
    if (toolCallParts.length > 0) {
      result.toolCalls = JSON.stringify(toolCallParts);
    }
    if (objectParts.length > 0) {
      result.responseObject = JSON.stringify(
        objectParts.length === 1 ? objectParts[0] : objectParts
      );
    }
  } catch {
    // Parsing failed, return empty result
  }

  return result;
}

/**
 * Gets AI output content, checking attributes in priority order.
 * Priority: gen_ai.output.messages > gen_ai.response.text/object
 */
function getAIOutputData(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
): AIOutputData {
  const outputMessages = getTraceNodeAttribute(
    'gen_ai.output.messages',
    node,
    event,
    attributes
  );
  if (outputMessages) {
    const extracted = extractFromOutputMessages(outputMessages.toString());
    if (extracted.responseText || extracted.responseObject || extracted.toolCalls) {
      return extracted;
    }
  }

  const responseText = getTraceNodeAttribute(
    'gen_ai.response.text',
    node,
    event,
    attributes
  );
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
    responseText: responseText?.toString() ?? null,
    responseObject: responseObject?.toString() ?? null,
    toolCalls: toolCalls?.toString() ?? null,
  };
}

export function hasAIOutputAttribute(
  node: EapSpanNode | SpanNode | TransactionNode,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
    getTraceNodeAttribute('gen_ai.output.messages', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.response.text', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.response.object', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.response.tool_calls', node, event, attributes) ||
    getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes)
  );
}

export function AIOutputSection({
  node,
  attributes,
  event,
}: {
  node: EapSpanNode | SpanNode | TransactionNode;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  if (!getIsAiNode(node) || !hasAIOutputAttribute(node, attributes, event)) {
    return null;
  }

  const {responseText, responseObject, toolCalls} = getAIOutputData(
    node,
    attributes,
    event
  );
  const toolOutput = getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes);

  if (!responseText && !responseObject && !toolCalls && !toolOutput) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.AI_OUTPUT}
      title={t('Output')}
      disableCollapsePersistence
    >
      {responseText && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response')}
          </TraceDrawerComponents.MultilineTextLabel>
          {renderAIResponse(responseText)}
        </Fragment>
      )}
      {responseObject && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          {renderAIResponse(responseObject)}
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

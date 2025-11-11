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
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

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

export function hasAIOutputAttribute(
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>,
  attributes?: TraceItemResponseAttribute[],
  event?: EventTransaction
) {
  return (
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
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  if (!getIsAiNode(node) || !hasAIOutputAttribute(node, attributes, event)) {
    return null;
  }

  const responseText = getTraceNodeAttribute(
    'gen_ai.response.text',
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
  const toolOutput = getTraceNodeAttribute('gen_ai.tool.output', node, event, attributes);
  const responseObject = getTraceNodeAttribute(
    'gen_ai.response.object',
    node,
    event,
    attributes
  );

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
          {renderAIResponse(responseText.toString())}
        </Fragment>
      )}
      {responseObject && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          {renderAIResponse(responseObject.toString())}
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

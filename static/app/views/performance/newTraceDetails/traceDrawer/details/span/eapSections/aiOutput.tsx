import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {hasAgentInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {
  getIsAiNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export function AIOutputSection({
  node,
  attributes,
  event,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  const organization = useOrganization();
  if (!hasAgentInsightsFeature(organization) && getIsAiNode(node)) {
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
          <TraceDrawerComponents.MultilineText>
            {responseText.trim()}
          </TraceDrawerComponents.MultilineText>
        </Fragment>
      )}
      {responseObject && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Response Object')}
          </TraceDrawerComponents.MultilineTextLabel>
          <TraceDrawerComponents.MultilineJSON
            value={responseObject}
            maxDefaultDepth={2}
          />
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

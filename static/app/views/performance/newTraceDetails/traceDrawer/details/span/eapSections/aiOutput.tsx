import {Fragment} from 'react';

import {StructuredData} from 'sentry/components/structuredEventData';
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

function tryParseJson(value: any) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
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

  if (!responseText && !toolCalls && !toolOutput) {
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
      {toolCalls && (
        <Fragment>
          <TraceDrawerComponents.MultilineTextLabel>
            {t('Tool Calls')}
          </TraceDrawerComponents.MultilineTextLabel>
          <TraceDrawerComponents.MultilineText>
            <StructuredData
              value={tryParseJson(toolCalls)}
              maxDefaultDepth={2}
              withAnnotatedText
            />
          </TraceDrawerComponents.MultilineText>
        </Fragment>
      )}
      {toolOutput ? (
        <TraceDrawerComponents.MultilineJSON value={toolOutput} maxDefaultDepth={1} />
      ) : null}
    </FoldSection>
  );
}

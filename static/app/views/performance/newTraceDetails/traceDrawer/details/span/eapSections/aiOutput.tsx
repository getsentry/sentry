import styled from '@emotion/styled';

import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  const responseText = getTraceNodeAttribute('ai.response.text', node, event, attributes);
  const toolCalls = getTraceNodeAttribute(
    'ai.response.toolCalls',
    node,
    event,
    attributes
  );

  if (!responseText && !toolCalls) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.AI_OUTPUT}
      title={t('Output')}
      disableCollapsePersistence
    >
      {responseText && (
        <MultilineText>
          <strong>{t('Response')}</strong>
          <br />
          {responseText}
        </MultilineText>
      )}
      {toolCalls && (
        <MultilineText>
          <strong>{t('Tool Calls')}</strong>
          <br />
          <StructuredData
            value={tryParseJson(toolCalls)}
            maxDefaultDepth={2}
            withAnnotatedText
          />
        </MultilineText>
      )}
    </FoldSection>
  );
}

const MultilineText = styled('div')`
  white-space: pre-wrap;
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  &:not(:last-child) {
    margin-bottom: ${space(1.5)};
  }

  & p {
    margin: 0;
  }
`;

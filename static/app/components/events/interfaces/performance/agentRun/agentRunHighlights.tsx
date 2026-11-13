import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {eventHasSyntheticTrace} from 'sentry/components/events/interfaces/performance/utils';
import {
  KeyValueColumns,
  KeyValueTableDataRow,
} from 'sentry/components/tables/keyValueTable';
import {t, tct, tn} from 'sentry/locale';
import {EventOrGroupType, type Event} from 'sentry/types/event';
import type {KeyValueListDataItem} from 'sentry/types/group';
import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {
  getIsAiAgentNode,
  getIsAiGenerationNode,
  getIsExecuteToolNode,
  getStringAttr,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {useAgentActivityLink} from './eventAgentRun';
import {
  STATS_PERIOD,
  useAgentRunStepBreakdown,
  type AgentRunStepBreakdown,
  type AgentRunStepCount,
} from './useAgentRunStepBreakdown';
import {useEventAgentRun} from './useEventAgentRun';

/**
 * Fewer events than this say nothing about a pattern.
 */
const MIN_MATCHED_EVENTS = 3;
/**
 * Share of events a step needs before it is called out on its own.
 */
const DOMINANT_STEP_SHARE = 0.6;
const MAX_LISTED_STEPS = 3;

function getModel(nodes: AITraceSpanNode[]) {
  for (const node of nodes) {
    const model =
      getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL) ||
      getStringAttr(node, SpanFields.GEN_AI_REQUEST_MODEL);
    if (model && (getIsAiAgentNode(node) || getIsAiGenerationNode(node))) {
      return model;
    }
  }
  return null;
}

function getStepName(node: AITraceSpanNode) {
  return (
    getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME) ||
    node.description ||
    node.op ||
    t('Unknown step')
  );
}

function getToolInput(node: AITraceSpanNode): KeyValueListDataItem['value'] | null {
  if (!getIsExecuteToolNode(node)) {
    return null;
  }
  const input =
    getStringAttr(node, 'gen_ai.tool.call.arguments') ||
    getStringAttr(node, 'gen_ai.tool.input');
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function StepLink({
  event,
  step,
  traceIds,
}: {
  event: Event;
  step: AgentRunStepCount;
  traceIds: string[];
}) {
  const organization = useOrganization();
  const to = getExploreUrl({
    organization,
    mode: Mode.SAMPLES,
    selection: {
      projects: [Number(event.projectID)],
      environments: [],
      datetime: {period: STATS_PERIOD, start: null, end: null, utc: null},
    },
    // The trace filter is what makes the span id lookup find the spans.
    query: `trace:[${traceIds.join(',')}] id:[${step.spanIds.join(',')}]`,
  });
  return <Link to={to}>{step.step}</Link>;
}

function AcrossEventsValue({
  breakdown,
  event,
}: {
  breakdown: AgentRunStepBreakdown;
  event: Event;
}) {
  const {steps, matchedEvents, sampledEvents, traceIds} = breakdown;
  const [top] = steps;
  if (!top) {
    return null;
  }

  const recentEvents = (
    <InfoText
      title={tct('[matched] of the last [sampled] events have span data.', {
        matched: matchedEvents,
        sampled: sampledEvents,
      })}
    >
      {tn('%s recent event', '%s recent events', matchedEvents)}
    </InfoText>
  );

  if (top.count / matchedEvents >= DOMINANT_STEP_SHARE) {
    return (
      <Text>
        {tct('[step] in [count] of [recentEvents]', {
          step: <StepLink event={event} step={top} traceIds={traceIds} />,
          count: top.count,
          recentEvents,
        })}
      </Text>
    );
  }

  const listed = steps.slice(0, MAX_LISTED_STEPS);
  const otherCount = steps
    .slice(MAX_LISTED_STEPS)
    .reduce((sum, step) => sum + step.count, 0);

  return (
    <Text>
      {listed.map((step, index) => (
        <Fragment key={step.step}>
          {index > 0 && ', '}
          <StepLink event={event} step={step} traceIds={traceIds} /> ({step.count})
        </Fragment>
      ))}
      {otherCount > 0 && tct(', [count] other', {count: otherCount})}
      {tct(' across [recentEvents]', {recentEvents})}
    </Text>
  );
}

/**
 * Highlights about the agent run an error was raised in: what failed in this event,
 * and which step the issue's recent events failed in.
 */
export function AgentRunHighlights({event}: {event: Event}) {
  const organization = useOrganization();
  const enabled =
    organization.features.includes('issue-details-agent-run') &&
    event.type === EventOrGroupType.ERROR &&
    !!event.contexts.trace?.trace_id &&
    !eventHasSyntheticTrace(event);

  const agentRun = useEventAgentRun(event, {enabled});
  const isInsideRun = agentRun.type === 'inside';
  const breakdown = useAgentRunStepBreakdown(event, {enabled: isInsideRun});
  const getAgentActivityLink = useAgentActivityLink(event);

  if (!isInsideRun) {
    return null;
  }

  const {failingNode, nodes} = agentRun;
  const [runNode] = nodes;
  const agentName =
    runNode && getIsAiAgentNode(runNode)
      ? getStringAttr(runNode, SpanFields.GEN_AI_AGENT_NAME) ||
        getStringAttr(runNode, SpanFields.GEN_AI_FUNCTION_ID)
      : undefined;
  const model = getModel(nodes);
  const toolInput = getToolInput(failingNode);
  const stepIndex = nodes.findIndex(node => node.id === failingNode.id);

  const thisEventItems: KeyValueListDataItem[] = [];
  if (agentName) {
    thisEventItems.push({key: 'agent', subject: t('Agent'), value: agentName});
  }
  thisEventItems.push({
    key: 'failed_step',
    subject: t('Failed step'),
    value: (
      <Fragment>
        <Link to={getAgentActivityLink(failingNode.id)}>{getStepName(failingNode)}</Link>{' '}
        <Text variant="muted">
          {tct('· step [index] of [total]', {index: stepIndex + 1, total: nodes.length})}
        </Text>
      </Fragment>
    ),
  });
  if (model) {
    thisEventItems.push({
      key: 'model',
      subject: t('Model'),
      value: <ModelName modelId={model} size={12} gap="xs" />,
    });
  }

  const issueItems: KeyValueListDataItem[] = [];
  if (
    breakdown &&
    breakdown.matchedEvents >= MIN_MATCHED_EVENTS &&
    breakdown.steps.length > 0
  ) {
    issueItems.push({
      key: 'across_events',
      subject: t('Across events'),
      value: <AcrossEventsValue breakdown={breakdown} event={event} />,
    });
  }
  if (toolInput !== null) {
    issueItems.push({key: 'tool_input', subject: t('Tool input'), value: toolInput});
  }

  const toRows = (items: KeyValueListDataItem[]) =>
    items.map(item => (
      <KeyValueTableDataRow
        key={item.key}
        item={item}
        // Tool input is structured data that can be expanded; the rest are nodes.
        disableFormattedData={item.key !== 'tool_input'}
        data-test-id="agent-run-highlight-row"
      />
    ));

  return (
    <Container borderTop="muted" paddingTop="md" marginTop="md">
      <Flex gap="sm" align="baseline" padding="0 0 sm 0">
        <Text size="sm" bold uppercase>
          {t('Agent run')}
        </Text>
        <Text size="sm" variant="muted">
          {t('Added because this error was raised inside an agent run')}
        </Text>
      </Flex>
      <KeyValueColumns>
        {columnCount =>
          // Keep this event's details apart from the ones about the issue.
          columnCount > 1 && issueItems.length > 0
            ? [toRows(thisEventItems), toRows(issueItems)]
            : splitIntoColumns(toRows([...thisEventItems, ...issueItems]), columnCount)
        }
      </KeyValueColumns>
    </Container>
  );
}

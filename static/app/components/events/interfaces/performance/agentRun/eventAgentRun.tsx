import {useCallback} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import {
  getIsAiGenerationNode,
  getStringAttr,
  resolveAgentName,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {getTraceLinkForIssue} from 'sentry/views/performance/traceDetails/issuesTraceWaterfallOverlay';
import {TraceViewSources} from 'sentry/views/performance/traceDetails/traceHeader/traceViewSources';
import {getTraceTargetFromEvent} from 'sentry/views/performance/traceDetails/traceTarget';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

import type {EventAgentRun} from './useEventAgentRun';

/**
 * Returns a link to the Agent Activity tab of the event's trace, with `nodeId` selected.
 */
function useAgentActivityLink(event: Event) {
  const organization = useOrganization();
  const location = useLocation();

  return useCallback(
    (nodeId?: string) => {
      const traceTarget = getTraceTargetFromEvent(
        event,
        organization,
        {
          ...location,
          query: {groupId: event.groupID, referrer: location.query.referrer},
        },
        TraceViewSources.ISSUE_DETAILS
      );
      if (typeof traceTarget === 'string') {
        return traceTarget;
      }
      return getTraceLinkForIssue(
        {...traceTarget, query: {...traceTarget.query, tab: TraceLayoutTabKeys.AI_SPANS}},
        nodeId ? [`span-${nodeId}`] : undefined
      );
    },
    [event, organization, location]
  );
}

function getModel(nodes: AITraceSpanNode[], failingNode: AITraceSpanNode) {
  const generationNode = getIsAiGenerationNode(failingNode)
    ? failingNode
    : nodes.find(getIsAiGenerationNode);
  if (!generationNode) {
    return null;
  }
  return (
    getStringAttr(generationNode, SpanFields.GEN_AI_RESPONSE_MODEL) ??
    getStringAttr(generationNode, SpanFields.GEN_AI_REQUEST_MODEL)
  );
}

const SURROUNDING_STEPS = 3;

/**
 * Keeps the steps around the failing one, like the trace preview does around an error.
 */
function getVisibleSteps(nodes: AITraceSpanNode[], failingNode: AITraceSpanNode) {
  const index = nodes.findIndex(node => node.id === failingNode.id);
  let start = Math.max(0, index - SURROUNDING_STEPS);
  let end = Math.min(nodes.length, index + SURROUNDING_STEPS + 1);
  // Hiding a single step saves no space, so show it instead.
  if (start === 1) {
    start = 0;
  }
  if (nodes.length - end === 1) {
    end = nodes.length;
  }
  return {
    steps: nodes.slice(start, end),
    hiddenBefore: start,
    hiddenAfter: nodes.length - end,
  };
}

function HiddenStepsLink({count, to}: {count: number; to: LinkProps['to']}) {
  if (count === 0) {
    return null;
  }
  return (
    <Text size="sm" variant="muted">
      <Link to={to}>{tn('%s more step', '%s more steps', count)}</Link>
    </Text>
  );
}

interface AgentRunProps {
  agentRun: EventAgentRun;
  event: Event;
}

function getFocusNode(agentRun: InsideOrElsewhere) {
  return agentRun.type === 'inside' ? agentRun.failingNode : agentRun.focusNode;
}

type InsideOrElsewhere = Extract<EventAgentRun, {type: 'inside' | 'elsewhere'}>;

/**
 * Where the error was raised relative to an agent run it was not part of.
 */
function getErrorPosition(runNode: AITraceSpanNode, errorTimestamp: number) {
  const [start, duration] = runNode.space;
  const end = start + duration;
  if (errorTimestamp < start) {
    return t('%s before this run', getDuration((start - errorTimestamp) / 1000, 2, true));
  }
  if (errorTimestamp > end) {
    return t('%s after this run', getDuration((errorTimestamp - end) / 1000, 2, true));
  }
  return t('During this run, outside its spans');
}

/**
 * Opens the trace's Agent Activity tab, with the step closest to the error selected.
 */
export function OpenAgentActivityButton({agentRun, event}: AgentRunProps) {
  const getAgentActivityLink = useAgentActivityLink(event);

  return (
    <LinkButton
      size="xs"
      to={getAgentActivityLink(
        agentRun.type === 'inside' || agentRun.type === 'elsewhere'
          ? getFocusNode(agentRun).id
          : undefined
      )}
      analyticsEventName="Issue Details: Open Agent Activity Clicked"
      analyticsEventKey="issue_details.agent_run.open_agent_activity_clicked"
    >
      {t('Open Agent Activity')}
    </LinkButton>
  );
}

/**
 * The Agent Activity view of the trace preview.
 */
export function EventAgentActivity({agentRun, event}: AgentRunProps) {
  const navigate = useNavigate();
  const getAgentActivityLink = useAgentActivityLink(event);

  if (agentRun.type === 'none' || agentRun.type === 'loading') {
    return null;
  }

  const {runNode, nodes} = agentRun;
  const focusNode = getFocusNode(agentRun);
  const isInside = agentRun.type === 'inside';
  const summary = [
    {
      label: t('Agent'),
      value: resolveAgentName(runNode.attributes ?? {}) ?? runNode.description,
    },
    {label: t('Model'), value: getModel(nodes, focusNode)},
    isInside
      ? {label: t('Error raised in'), value: focusNode.description ?? focusNode.op}
      : {
          label: t('Error raised'),
          value: getErrorPosition(runNode, agentRun.errorTimestamp),
        },
    {label: t('Duration'), value: getDuration(runNode.space[1] / 1000, 2, true)},
  ].filter(item => item.value);
  const {steps, hiddenBefore, hiddenAfter} = getVisibleSteps(nodes, focusNode);
  const fullActivityLink = getAgentActivityLink(focusNode.id);

  return (
    <Stack gap="lg">
      {agentRun.type === 'elsewhere' && (
        <Text as="p" variant="muted">
          {agentRun.agentRunCount > 1
            ? t(
                'This error was raised outside the %s agent runs in this trace. This is the run closest to it.',
                agentRun.agentRunCount
              )
            : t('This error was raised outside the agent activity in this trace.')}
        </Text>
      )}
      <Grid columns={`repeat(${summary.length}, max-content)`} gap="2xs xl">
        {summary.map(({label}) => (
          <Text key={`label-${label}`} size="xs" variant="muted" uppercase>
            {label}
          </Text>
        ))}
        {summary.map(({label, value}) => (
          <Text key={`value-${label}`} size="sm" bold ellipsis>
            {value}
          </Text>
        ))}
      </Grid>
      <Stack gap="xs">
        <HiddenStepsLink count={hiddenBefore} to={fullActivityLink} />
        <AiSpanTimeline
          nodes={steps}
          // Only highlight a step when the error was raised inside it.
          selectedNodeKey={isInside ? focusNode.id : null}
          onSelectNode={node => navigate(getAgentActivityLink(node.id))}
        />
        <HiddenStepsLink count={hiddenAfter} to={fullActivityLink} />
      </Stack>
    </Stack>
  );
}

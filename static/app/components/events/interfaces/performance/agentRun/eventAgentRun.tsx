import {useCallback} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {getTraceLinkForIssue} from 'sentry/views/performance/traceDetails/issuesTraceWaterfallOverlay';
import {TraceViewSources} from 'sentry/views/performance/traceDetails/traceHeader/traceViewSources';
import {getTraceTargetFromEvent} from 'sentry/views/performance/traceDetails/traceTarget';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

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
        {...location, query: {groupId: event.groupID, referrer: location.query.referrer}},
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

function HiddenStepsRow({
  count,
  to,
  position,
}: {
  count: number;
  position: 'top' | 'bottom';
  to: LinkProps['to'];
}) {
  const organization = useOrganization();
  if (count === 0) {
    return null;
  }
  return (
    <Container
      padding="sm md"
      borderBottom={position === 'top' ? 'muted' : undefined}
      borderTop={position === 'bottom' ? 'muted' : undefined}
    >
      <Text size="sm" variant="muted">
        <Link
          to={to}
          onClick={() =>
            trackAnalytics('issue_details.agent_run.step_clicked', {
              organization,
              source: 'hidden_steps',
            })
          }
        >
          {tn('%s more step', '%s more steps', count)}
        </Link>
      </Text>
    </Container>
  );
}

/**
 * Opens the trace's Agent Activity tab with the failing step selected.
 */
export function AgentActivityFullTraceButton({
  event,
  failingNodeId,
}: {
  event: Event;
  failingNodeId: string;
}) {
  const getAgentActivityLink = useAgentActivityLink(event);

  return (
    <LinkButton
      size="xs"
      to={getAgentActivityLink(failingNodeId)}
      analyticsEventName="Issue Details: View Full Trace Agent Activity Clicked"
      analyticsEventKey="issue_details.agent_run.view_full_trace_clicked"
    >
      {t('View Full Trace')}
    </LinkButton>
  );
}

/**
 * The Agent Activity view of the trace preview: the steps around the failing one.
 */
export function EventAgentActivity({
  event,
  failingNode,
  nodes,
}: {
  event: Event;
  failingNode: AITraceSpanNode;
  nodes: AITraceSpanNode[];
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const getAgentActivityLink = useAgentActivityLink(event);

  const {steps, hiddenBefore, hiddenAfter} = getVisibleSteps(nodes, failingNode);
  const fullActivityLink = getAgentActivityLink(failingNode.id);

  return (
    <Container border="primary" radius="md" overflow="hidden">
      <HiddenStepsRow count={hiddenBefore} position="top" to={fullActivityLink} />
      <Container padding="xs">
        <AiSpanTimeline
          nodes={steps}
          selectedNodeKey={failingNode.id}
          onSelectNode={node => {
            trackAnalytics('issue_details.agent_run.step_clicked', {
              organization,
              source: 'timeline',
            });
            navigate(getAgentActivityLink(node.id));
          }}
        />
      </Container>
      <HiddenStepsRow count={hiddenAfter} position="bottom" to={fullActivityLink} />
    </Container>
  );
}

/**
 * Stands in for the whole Trace Preview while it works out which view to open, so
 * the section appears in one step instead of growing as each request finishes.
 */
export function TraceViewSkeleton() {
  return (
    <Stack gap="md" data-test-id="trace-view-skeleton">
      <Container border="primary" radius="md" overflow="hidden">
        <Container padding="xs">
          <AiSpanTimeline
            nodes={[]}
            selectedNodeKey={null}
            onSelectNode={noop}
            isLoading
          />
        </Container>
      </Container>
      <Placeholder height="16px" width="280px" />
      <Placeholder height="80px" />
    </Stack>
  );
}

export function TraceViewActionsSkeleton() {
  return (
    <Flex align="center" gap="md">
      <Placeholder height="24px" width="96px" />
      <Placeholder height="24px" width="150px" />
    </Flex>
  );
}

function noop() {}

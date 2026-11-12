import {useCallback} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';
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
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
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

interface AgentRunProps {
  agentRun: EventAgentRun;
  event: Event;
}

export function EventAgentRunSection({agentRun, event}: AgentRunProps) {
  const navigate = useNavigate();
  const getAgentActivityLink = useAgentActivityLink(event);

  if (agentRun.type !== 'inside') {
    return null;
  }

  const {runNode, failingNode, nodes} = agentRun;
  const summary = [
    {
      label: t('Agent'),
      value: resolveAgentName(runNode.attributes ?? {}) ?? runNode.description,
    },
    {label: t('Model'), value: getModel(nodes, failingNode)},
    {
      label: t('Error raised in'),
      value: failingNode.description ?? failingNode.op,
    },
    {label: t('Duration'), value: getDuration(runNode.space[1] / 1000, 2, true)},
  ].filter(item => item.value);

  return (
    <FoldSection
      sectionKey={SectionKey.AGENT_RUN}
      title={t('Agent Run')}
      actions={
        <LinkButton
          size="xs"
          variant="primary"
          to={getAgentActivityLink(failingNode.id)}
          analyticsEventName="Issue Details: Open Agent Activity Clicked"
          analyticsEventKey="issue_details.agent_run.open_agent_activity_clicked"
        >
          {t('Open Agent Activity')}
        </LinkButton>
      }
    >
      <Stack gap="lg">
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
        <AiSpanTimeline
          nodes={nodes}
          selectedNodeKey={failingNode.id}
          onSelectNode={node => navigate(getAgentActivityLink(node.id))}
        />
      </Stack>
    </FoldSection>
  );
}

/**
 * Points to the trace's agent activity when the error was raised outside of it.
 */
export function TraceAgentActivityHint({agentRun, event}: AgentRunProps) {
  const getAgentActivityLink = useAgentActivityLink(event);

  if (agentRun.type !== 'elsewhere') {
    return null;
  }

  return (
    <Alert
      variant="info"
      trailingItems={
        <LinkButton
          size="xs"
          to={getAgentActivityLink()}
          analyticsEventName="Issue Details: Trace Agent Activity Hint Clicked"
          analyticsEventKey="issue_details.agent_run.trace_hint_clicked"
        >
          {t('Open Agent Activity')}
        </LinkButton>
      }
    >
      {agentRun.agentRunCount > 0
        ? tn(
            'This trace also has %s agent run, which may give context for this error.',
            'This trace also has %s agent runs, which may give context for this error.',
            agentRun.agentRunCount
          )
        : t('This trace also has AI spans, which may give context for this error.')}
    </Alert>
  );
}

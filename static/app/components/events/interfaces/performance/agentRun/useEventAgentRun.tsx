import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {isWebVitalsEvent} from 'sentry/components/events/interfaces/performance/utils';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {AI_TRACE_BASE_ATTRIBUTES} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {
  getGenAiOpType,
  getIsAiAgentNode,
  getIsAiNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  getHasAiSpansFilter,
  getIsAiAgentSpan,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {useTrace} from 'sentry/views/performance/traceDetails/traceApi/useTrace';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';

export type EventAgentRun =
  | {type: 'none'}
  /**
   * The trace is still being fetched, so it is not known yet whether there is an agent run.
   */
  | {type: 'loading'}
  /**
   * The error was raised inside an AI span. `failingNode` is the closest AI span
   * above the error, and `nodes` are the AI spans of the agent run that contains it,
   * starting with the agent span.
   */
  | {
      failingNode: AITraceSpanNode;
      nodes: AITraceSpanNode[];
      type: 'inside';
    };

const NO_AGENT_RUN: EventAgentRun = {type: 'none'};

function isAiSpanNode(node: BaseNode): node is AITraceSpanNode {
  return isEAPSpanNode(node) && getIsAiNode(node);
}

function isAiAgentSpanNode(node: BaseNode): node is AITraceSpanNode {
  return isEAPSpanNode(node) && getIsAiAgentNode(node);
}

export function getEventAgentRun(
  trace: TraceTree.EAPTrace,
  eventId: string,
  organization: Organization
): EventAgentRun {
  const tree = TraceTree.FromTrace(trace, {
    replay: null,
    preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    organization,
  });
  tree.build();

  const eventNode = tree.root
    .findAllChildren(node => node.matchById(eventId))
    .toSorted((a, b) => b.searchPriority - a.searchPriority)[0];

  const failingNode = eventNode
    ? isAiSpanNode(eventNode)
      ? eventNode
      : eventNode.findParent(isAiSpanNode)
    : null;

  if (!failingNode) {
    return NO_AGENT_RUN;
  }

  // An LLM call made outside an agent framework has no agent span to anchor on.
  const runNode = getIsAiAgentSpan(getGenAiOpType(failingNode))
    ? failingNode
    : (failingNode.findParent(isAiAgentSpanNode) ?? failingNode);

  return {
    type: 'inside',
    failingNode,
    nodes: [runNode, ...runNode.findAllChildren(isAiSpanNode)].toSorted(
      (x, y) => x.space[0] - y.space[0]
    ),
  };
}

// TODO(aknaus): Split AI_TRACE_BASE_ATTRIBUTES into the attributes the timeline
// needs and the ones only the transcript needs.
const AGENT_RUN_ATTRIBUTES = AI_TRACE_BASE_ATTRIBUTES.filter(
  attribute =>
    attribute !== SpanFields.GEN_AI_INPUT_MESSAGES &&
    attribute !== SpanFields.GEN_AI_OUTPUT_MESSAGES
);

const HAS_AI_SPAN_TOLERANCE_S = 1;
const DAY_IN_S = 24 * 60 * 60;

/**
 * A one-row spans query for an AI span that was active when the error happened, so
 * the much more expensive trace request only runs when there can be an agent run.
 */
function activeAiSpanOptions({
  organizationSlug,
  timestamp,
  traceId,
}: {
  organizationSlug: string;
  timestamp: number | undefined;
  traceId: string | undefined;
}) {
  const canQuery = traceId !== undefined && timestamp !== undefined;
  return apiOptions.as<{data: Array<{id: string}>}>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: canQuery ? {organizationIdOrSlug: organizationSlug} : skipToken,
      query: canQuery
        ? {
            dataset: DiscoverDatasets.SPANS,
            field: ['id'],
            per_page: 1,
            project: ALL_ACCESS_PROJECTS,
            start: getUtcDateString((timestamp - DAY_IN_S) * 1000),
            end: getUtcDateString((timestamp + DAY_IN_S) * 1000),
            query: [
              `trace:${traceId}`,
              getHasAiSpansFilter(),
              `precise.start_ts:<=${timestamp + HAS_AI_SPAN_TOLERANCE_S}`,
              `precise.finish_ts:>=${timestamp - HAS_AI_SPAN_TOLERANCE_S}`,
            ].join(' '),
            sampling: SAMPLING_MODE.HIGH_ACCURACY,
            referrer: 'api.issues.agent-run.has-active-ai-span',
          }
        : {},
      staleTime: Infinity,
    }
  );
}

/**
 * Finds the AI agent run that an error event was raised in, from the event's trace.
 */
export function useEventAgentRun(event: Event, {enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const canHaveAgentRun = enabled && !isWebVitalsEvent(event);
  const traceId = canHaveAgentRun ? event.contexts.trace?.trace_id : undefined;
  const timestamp = getEventTimestampInSeconds(event);

  const activeAiSpan = useQuery(
    activeAiSpanOptions({organizationSlug: organization.slug, traceId, timestamp})
  );
  const hasActiveAiSpan = (activeAiSpan.data?.data.length ?? 0) > 0;

  const trace = useTrace({
    // useTrace only fetches when it has a trace slug.
    traceSlug: hasActiveAiSpan ? traceId : undefined,
    timestamp,
    targetEventId: event.eventID,
    additionalAttributes: AGENT_RUN_ATTRIBUTES,
    disableUrlSync: true,
    referrer: 'api.trace-view.issues.agent-run',
  });

  return useMemo((): EventAgentRun => {
    if (activeAiSpan.isLoading || trace.isLoading) {
      return {type: 'loading'};
    }
    if (!trace.data) {
      return NO_AGENT_RUN;
    }
    try {
      return getEventAgentRun(trace.data, event.eventID, organization);
    } catch {
      return NO_AGENT_RUN;
    }
  }, [activeAiSpan.isLoading, trace.isLoading, trace.data, event.eventID, organization]);
}

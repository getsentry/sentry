import {useMemo} from 'react';

import {isWebVitalsEvent} from 'sentry/components/events/interfaces/performance/utils';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AI_TRACE_BASE_ATTRIBUTES} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {
  getGenAiOpType,
  getIsAiAgentNode,
  getIsAiNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getIsAiAgentSpan} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
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
   * above the error, and `runNode` is the agent span that contains it, if any.
   */
  | {
      failingNode: AITraceSpanNode;
      nodes: AITraceSpanNode[];
      runNode: AITraceSpanNode;
      type: 'inside';
    }
  /**
   * The trace has AI spans, but the error was raised outside all of them.
   * `runNode` is the agent run closest in time to the error, and `focusNode` is
   * its last step that started before the error.
   */
  | {
      agentRunCount: number;
      errorTimestamp: number;
      focusNode: AITraceSpanNode;
      nodes: AITraceSpanNode[];
      runNode: AITraceSpanNode;
      type: 'elsewhere';
    };

const NO_AGENT_RUN: EventAgentRun = {type: 'none'};

function isAiSpanNode(node: BaseNode): node is AITraceSpanNode {
  return isEAPSpanNode(node) && getIsAiNode(node);
}

function isAiAgentSpanNode(node: BaseNode): node is AITraceSpanNode {
  return isEAPSpanNode(node) && getIsAiAgentNode(node);
}

function getRunNodes(runNode: AITraceSpanNode) {
  return [runNode, ...runNode.findAllChildren(isAiSpanNode)].toSorted(
    (a, b) => a.space[0] - b.space[0]
  );
}

/**
 * The error's own timestamp in ms. The node that matches an error can be the span it
 * was raised in, which starts earlier.
 */
function getErrorTimestamp(eventNode: BaseNode, eventId: string) {
  const error = [...eventNode.errors].find(item => item.event_id === eventId);
  return error && 'start_timestamp' in error
    ? error.start_timestamp * 1e3
    : eventNode.space[0];
}

/**
 * How far `timestamp` is from the node's time range, in ms. 0 when it falls inside.
 */
function getDistance(node: AITraceSpanNode, timestamp: number) {
  const [start, duration] = node.space;
  return Math.max(0, start - timestamp, timestamp - (start + duration));
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

  if (failingNode) {
    // An LLM call made outside an agent framework has no agent span to anchor on.
    const runNode = getIsAiAgentSpan(getGenAiOpType(failingNode))
      ? failingNode
      : (failingNode.findParent(isAiAgentSpanNode) ?? failingNode);

    return {
      type: 'inside',
      failingNode,
      runNode,
      nodes: getRunNodes(runNode),
    };
  }

  const aiNodes = tree.root.findAllChildren(isAiSpanNode);
  if (aiNodes.length === 0) {
    return NO_AGENT_RUN;
  }

  // Top-level agent runs, or the AI spans themselves when no agent framework is used.
  const agentNodes = aiNodes.filter(isAiAgentSpanNode);
  const runs = agentNodes.length
    ? agentNodes.filter(node => !node.findParent(isAiAgentSpanNode))
    : aiNodes.filter(node => !node.findParent(isAiSpanNode));
  const errorTimestamp = eventNode ? getErrorTimestamp(eventNode, eventId) : 0;
  const runNode = runs.toSorted(
    (a, b) => getDistance(a, errorTimestamp) - getDistance(b, errorTimestamp)
  )[0];
  if (!runNode) {
    return NO_AGENT_RUN;
  }
  const nodes = agentNodes.length
    ? getRunNodes(runNode)
    : aiNodes.toSorted((a, b) => a.space[0] - b.space[0]);

  return {
    type: 'elsewhere',
    agentRunCount: agentNodes.length ? runs.length : 0,
    errorTimestamp,
    runNode,
    nodes,
    focusNode: nodes.findLast(node => node.space[0] <= errorTimestamp) ?? runNode,
  };
}

/**
 * Finds the AI agent run that an error event was raised in, from the event's trace.
 */
export function useEventAgentRun(event: Event, {enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const traceId = event.contexts.trace?.trace_id;

  const trace = useTrace({
    // useTrace only fetches when it has a trace slug.
    traceSlug: enabled ? traceId : undefined,
    timestamp: isWebVitalsEvent(event) ? undefined : getEventTimestampInSeconds(event),
    targetEventId: event.eventID,
    additionalAttributes: AI_TRACE_BASE_ATTRIBUTES,
    disableUrlSync: true,
  });

  return useMemo((): EventAgentRun => {
    if (trace.isLoading) {
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
  }, [trace.isLoading, trace.data, event.eventID, organization]);
}

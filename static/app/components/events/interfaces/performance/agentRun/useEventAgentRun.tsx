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
   */
  | {agentRunCount: number; type: 'elsewhere'};

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

  if (failingNode) {
    // An LLM call made outside an agent framework has no agent span to anchor on.
    const runNode = getIsAiAgentSpan(getGenAiOpType(failingNode))
      ? failingNode
      : (failingNode.findParent(isAiAgentSpanNode) ?? failingNode);

    return {
      type: 'inside',
      failingNode,
      runNode,
      nodes: [runNode, ...runNode.findAllChildren(isAiSpanNode)].toSorted(
        (a, b) => a.space[0] - b.space[0]
      ),
    };
  }

  const aiNodes = tree.root.findAllChildren(isAiSpanNode);
  if (aiNodes.length === 0) {
    return NO_AGENT_RUN;
  }

  return {
    type: 'elsewhere',
    agentRunCount: aiNodes.filter(node => getIsAiAgentNode(node)).length,
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

  return useMemo(() => {
    if (!trace.data) {
      return NO_AGENT_RUN;
    }
    try {
      return getEventAgentRun(trace.data, event.eventID, organization);
    } catch {
      return NO_AGENT_RUN;
    }
  }, [trace.data, event.eventID, organization]);
}

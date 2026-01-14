import {useEffect, useState} from 'react';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {getIsAiNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

interface UseAITraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
}

/**
 * Base attributes needed for AI trace display
 */
export const AI_TRACE_BASE_ATTRIBUTES = [
  SpanFields.GEN_AI_AGENT_NAME,
  SpanFields.GEN_AI_FUNCTION_ID,
  SpanFields.GEN_AI_REQUEST_MODEL,
  SpanFields.GEN_AI_RESPONSE_MODEL,
  SpanFields.GEN_AI_USAGE_TOTAL_TOKENS,
  SpanFields.GEN_AI_COST_TOTAL_TOKENS,
  SpanFields.GEN_AI_TOOL_NAME,
  SpanFields.GEN_AI_OPERATION_TYPE,
  SpanFields.GEN_AI_OPERATION_NAME,
  SpanFields.SPAN_STATUS,
  'status',
];

/**
 * Additional attributes needed for conversation messages display
 */
export const AI_CONVERSATION_ATTRIBUTES = [
  SpanFields.GEN_AI_CONVERSATION_ID,
  SpanFields.GEN_AI_REQUEST_MESSAGES,
  SpanFields.GEN_AI_RESPONSE_TEXT,
  SpanFields.GEN_AI_RESPONSE_OBJECT,
  SpanFields.GEN_AI_RESPONSE_TOOL_CALLS,
  SpanFields.USER_ID,
  SpanFields.USER_EMAIL,
  SpanFields.USER_USERNAME,
  SpanFields.USER_IP,
];

/**
 * Processes trace data to extract AI-related nodes.
 * Builds a TraceTree, fetches children for fetchable nodes, then filters for AI nodes.
 */
export async function processTraceForAINodes(
  traceData: TraceTree.Trace,
  api: Client,
  organization: Organization
): Promise<AITraceSpanNode[]> {
  const tree = TraceTree.FromTrace(traceData, {
    meta: null,
    replay: null,
    preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    organization,
  });

  tree.build();

  const fetchableNodes = tree.root.findAllChildren(node => node.canFetchChildren);

  const uniqueNodes = fetchableNodes.filter(
    (node, index, array) => index === array.findIndex(n => n.id === node.id)
  );

  const fetchPromises = uniqueNodes.map(node =>
    tree.fetchNodeSubTree(true, node, {
      api,
      organization,
      preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
    })
  );

  await Promise.all(fetchPromises);

  // Keep only transactions that include AI spans and the AI spans themselves
  const flattenedNodes = tree.root.findAllChildren<AITraceSpanNode>(node => {
    if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
      return false;
    }

    return getIsAiNode(node);
  });

  return flattenedNodes;
}

export function useAITrace(traceSlug: string, timestamp?: number): UseAITraceResult {
  const [nodes, setNodes] = useState<AITraceSpanNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const api = useApi();
  const organization = useOrganization();

  const trace = useTrace({
    traceSlug,
    timestamp,
    additionalAttributes: AI_TRACE_BASE_ATTRIBUTES,
  });

  useEffect(() => {
    if (trace.status !== 'success' || !trace.data) {
      setError(trace.status === 'error');
      setIsLoading(trace.status === 'pending');
      return;
    }

    const loadAllSpans = async () => {
      setIsLoading(true);
      setError(false);
      setNodes([]);

      try {
        const tree = TraceTree.FromTrace(trace.data, {
          meta: null,
          replay: null,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          organization,
        });

        tree.build();

        const fetchableNodes = tree.root.findAllChildren(node => node.canFetchChildren);

        const uniqueTransactions = fetchableNodes.filter(
          (node, index, array) => index === array.findIndex(n => n.id === node.id)
        );

        const zoomPromises = uniqueTransactions.map(node =>
          tree.fetchNodeSubTree(true, node, {
            api,
            organization,
            preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          })
        );

        await Promise.all(zoomPromises);

        // Keep only transactions that include AI spans and the AI spans themselves
        const flattenedNodes = tree.root.findAllChildren<AITraceSpanNode>(node => {
          if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
            return false;
          }

          return getIsAiNode(node);
        });

        setNodes(flattenedNodes);
        setIsLoading(false);
      } catch (err) {
        setError(true);
        setIsLoading(false);
      }
    };

    loadAllSpans();
  }, [trace.status, trace.data, organization, api]);

  return {
    nodes,
    isLoading,
    error,
  };
}

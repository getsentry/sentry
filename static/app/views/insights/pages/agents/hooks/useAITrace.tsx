import {useEffect, useState} from 'react';

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
  isTransactionNodeEquivalent,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

interface UseAITraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
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
    additionalAttributes: [
      SpanFields.GEN_AI_AGENT_NAME,
      SpanFields.GEN_AI_FUNCTION_ID,
      SpanFields.GEN_AI_REQUEST_MODEL,
      SpanFields.GEN_AI_RESPONSE_MODEL,
      SpanFields.GEN_AI_USAGE_TOTAL_TOKENS,
      SpanFields.GEN_AI_USAGE_TOTAL_COST,
      SpanFields.GEN_AI_TOOL_NAME,
      SpanFields.SPAN_STATUS,
      'status',
    ],
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

        const fetchableTransactions = TraceTree.FindAll(tree.root, node => {
          return isTransactionNode(node) && node.canFetch && node.value !== null;
        }).filter((node): node is TraceTreeNode<TraceTree.Transaction> =>
          isTransactionNode(node)
        );

        const uniqueTransactions = fetchableTransactions.filter(
          (node, index, array) =>
            index === array.findIndex(tx => tx.value.event_id === node.value.event_id)
        );

        const zoomPromises = uniqueTransactions.map(node =>
          tree.zoom(node, true, {
            api,
            organization,
            preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          })
        );

        await Promise.all(zoomPromises);

        // Keep only transactions that include AI spans and the AI spans themselves
        const flattenedNodes = TraceTree.FindAll(tree.root, node => {
          if (
            !isTransactionNodeEquivalent(node) &&
            !isSpanNode(node) &&
            !isEAPSpanNode(node)
          ) {
            return false;
          }

          return getIsAiNode(node);
        }) as AITraceSpanNode[];

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

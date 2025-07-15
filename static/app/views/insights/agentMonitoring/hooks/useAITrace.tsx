import {useEffect, useState} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {getIsAiNode} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import {
  AI_AGENT_NAME_ATTRIBUTE,
  AI_COST_ATTRIBUTE,
  AI_MODEL_ID_ATTRIBUTE,
  AI_MODEL_NAME_FALLBACK_ATTRIBUTE,
  AI_TOOL_NAME_ATTRIBUTE,
  AI_TOTAL_TOKENS_ATTRIBUTE,
} from 'sentry/views/insights/agentMonitoring/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
  isTransactionNodeEquivalent,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

interface UseAITraceResult {
  error: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
}

export function useAITrace(traceSlug: string): UseAITraceResult {
  const [nodes, setNodes] = useState<AITraceSpanNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const api = useApi();
  const organization = useOrganization();
  const queryParams = useTraceQueryParams();

  const meta = useTraceMeta([{traceSlug, timestamp: queryParams.timestamp}]);
  const trace = useTrace({
    traceSlug,
    timestamp: queryParams.timestamp,
    additionalAttributes: [
      AI_AGENT_NAME_ATTRIBUTE,
      AI_MODEL_ID_ATTRIBUTE,
      AI_MODEL_NAME_FALLBACK_ATTRIBUTE,
      AI_TOTAL_TOKENS_ATTRIBUTE,
      AI_COST_ATTRIBUTE,
      AI_TOOL_NAME_ATTRIBUTE,
    ],
  });

  useEffect(() => {
    if (trace.status !== 'success' || !trace.data || !meta.data) {
      setError(trace.status === 'error' || meta.status === 'error');
      setIsLoading(trace.status === 'pending' || meta.status === 'pending' || !meta.data);
      return;
    }

    const loadAllSpans = async () => {
      setIsLoading(true);
      setError(false);
      setNodes([]);

      try {
        const tree = TraceTree.FromTrace(trace.data, {
          meta: meta.data,
          replay: null,
          preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
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
  }, [trace.status, trace.data, meta.data, meta.status, organization, api]);

  return {
    nodes,
    isLoading,
    error,
  };
}

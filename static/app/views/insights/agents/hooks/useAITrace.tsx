import {useEffect, useState} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {getIsAiSpan} from 'sentry/views/insights/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNodeEquivalent,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
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

  const trace = useTrace({
    traceSlug,
    timestamp: queryParams.timestamp,
    additionalAttributes: [
      SpanFields.GEN_AI_AGENT_NAME,
      SpanFields.GEN_AI_FUNCTION_ID,
      SpanFields.GEN_AI_REQUEST_MODEL,
      SpanFields.GEN_AI_RESPONSE_MODEL,
      SpanFields.GEN_AI_USAGE_TOTAL_TOKENS,
      SpanFields.GEN_AI_USAGE_TOTAL_COST,
      SpanFields.GEN_AI_TOOL_NAME,
      SpanFields.SPAN_STATUS,
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

        const fetchableNodes = tree.root.findAllChildren(node => node.canFetchChildren);
        const fetchPromises = fetchableNodes.map(node =>
          tree.fetchNodeSubTree(true, node, {
            api,
            organization,
            preferences: DEFAULT_TRACE_VIEW_PREFERENCES,
          })
        );

        await Promise.all(fetchPromises);

        // Keep only transactions that include AI spans and the AI spans themselves
        const flattenedNodes = tree.root.findAllChildren(node => {
          if (
            !isTransactionNodeEquivalent(node) &&
            !isSpanNode(node) &&
            !isEAPSpanNode(node)
          ) {
            return false;
          }

          return getIsAiSpan({op: node.op});
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

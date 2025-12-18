import {useEffect, useMemo, useRef, useState} from 'react';

import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQueries} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_CONVERSATION_ATTRIBUTES,
  AI_TRACE_BASE_ATTRIBUTES,
  processTraceForAINodes,
} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export interface UseConversationsOptions {
  conversationId: string;
  traceIds: string[];
}

function nodeMatchesConversation(node: AITraceSpanNode, conversationId: string): boolean {
  if (isEAPSpanNode(node)) {
    return (
      node.value.additional_attributes?.[SpanFields.GEN_AI_CONVERSATION_ID] ===
      conversationId
    );
  }
  return true;
}

function getNodeTimestamp(node: AITraceSpanNode): number {
  return 'start_timestamp' in node.value ? node.value.start_timestamp : 0;
}

interface UseConversationResult {
  error: boolean;
  isLoading: boolean;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
}

type ProcessingStatus = 'idle' | 'processing' | 'error';

// This hook fetches multiple traces and processes them to get the nodes that belong to the conversation.
// TODO(telemetry-experience): Make an endpoint that returnes a conversation by id and use it here.
export function useConversation(
  conversation: UseConversationsOptions
): UseConversationResult {
  const [nodes, setNodes] = useState<AITraceSpanNode[]>([]);
  const [nodeTraceMap, setNodeTraceMap] = useState<Map<string, string>>(new Map());
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const processedConversationIdRef = useRef<string | null>(null);

  const api = useApi();
  const organization = useOrganization();

  const queryKeys: ApiQueryKey[] = useMemo(() => {
    return conversation.traceIds.map(traceId => [
      `/organizations/${organization.slug}/trace/${traceId}/`,
      {
        query: {
          project: -1,
          additional_attributes: [
            ...AI_TRACE_BASE_ATTRIBUTES,
            ...AI_CONVERSATION_ATTRIBUTES,
          ],
        },
      },
    ]);
  }, [conversation.traceIds, organization.slug]);

  const traceResults = useApiQueries<TraceTree.Trace>(queryKeys, {
    staleTime: Infinity,
    retry: false,
    enabled: conversation.traceIds.length > 0,
  });

  const allQueriesLoading = traceResults.some(result => result.isLoading);
  const anyQueryError = traceResults.some(result => result.isError);
  const allQueriesSuccessful = traceResults.every(result => result.isSuccess);
  const successfulDataCount = traceResults.filter(r => r.isSuccess && r.data).length;

  useEffect(() => {
    if (
      allQueriesLoading ||
      conversation.traceIds.length === 0 ||
      processedConversationIdRef.current === conversation.conversationId
    ) {
      return;
    }

    if (anyQueryError) {
      setProcessingStatus('error');
      return;
    }

    if (!allQueriesSuccessful || successfulDataCount !== conversation.traceIds.length) {
      return;
    }

    processedConversationIdRef.current = conversation.conversationId;

    const processTraces = async () => {
      setProcessingStatus('processing');

      try {
        const traceDataWithIds = traceResults
          .map((result, index) =>
            result.data
              ? {data: result.data, traceId: conversation.traceIds[index]!}
              : null
          )
          .filter(Boolean) as Array<{data: TraceTree.Trace; traceId: string}>;

        const allResults = await Promise.all(
          traceDataWithIds.map(async ({data, traceId}) => ({
            nodes: await processTraceForAINodes(data, api, organization),
            traceId,
          }))
        );

        const traceMap = new Map<string, string>();
        const combinedNodes = allResults.flatMap(({nodes: traceNodes, traceId}) => {
          traceNodes.forEach(node => traceMap.set(node.id, traceId));
          return traceNodes;
        });

        const filteredNodes = combinedNodes
          .filter(node => nodeMatchesConversation(node, conversation.conversationId))
          .sort((a, b) => getNodeTimestamp(a) - getNodeTimestamp(b));

        setNodes(filteredNodes);
        setNodeTraceMap(traceMap);
        setProcessingStatus('idle');
      } catch {
        setProcessingStatus('error');
      }
    };

    processTraces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allQueriesLoading,
    allQueriesSuccessful,
    anyQueryError,
    successfulDataCount,
    conversation.conversationId,
    conversation.traceIds.length,
  ]);

  if (conversation.traceIds.length === 0) {
    return {nodes: [], nodeTraceMap: new Map(), isLoading: false, error: false};
  }

  return {
    nodes,
    nodeTraceMap,
    isLoading: allQueriesLoading || processingStatus === 'processing',
    error: processingStatus === 'error' || anyQueryError,
  };
}

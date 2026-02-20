import {useMemo} from 'react';

import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  createNodeFromApiSpan,
  useConversation,
  type ConversationApiSpan,
  type UseConversationResult,
  type UseConversationsOptions,
} from 'sentry/views/insights/pages/conversations/hooks/useConversation';
import type {ConversationListMode} from 'sentry/views/insights/pages/conversations/hooks/useConversationList';

const TRACE_DETAIL_REFERRER = 'api.insights.conversations.trace-detail';

const TRACE_SPAN_FIELDS = [
  'span_id',
  'trace',
  'span.op',
  'span.description',
  'span.name',
  'span.status',
  'precise.start_ts',
  'precise.finish_ts',
  'project',
  'project.id',
  'gen_ai.conversation.id',
  'gen_ai.operation.type',
  'gen_ai.input.messages',
  'gen_ai.output.messages',
  'gen_ai.request.messages',
  'gen_ai.response.text',
  'gen_ai.response.object',
  'gen_ai.tool.name',
  'gen_ai.usage.total_tokens',
  'gen_ai.cost.total_tokens',
  'user.email',
  'user.id',
  'user.ip',
  'user.username',
] as const;

/**
 * Fetches conversation detail data from either the conversations API or
 * directly from trace spans, depending on the mode. Returns the same
 * node-based interface that the drawer components expect.
 */
export function useConversationDetail(
  conversation: UseConversationsOptions,
  mode: ConversationListMode = 'conversations'
): UseConversationResult {
  const isTraceMode = mode === 'traces';
  const traceId = conversation.conversationId;

  // Conversation mode: use the existing conversation API
  const conversationResult = useConversation(conversation, {enabled: !isTraceMode});

  // Trace mode: fetch gen_ai spans for this trace via EAP
  const spansResult = useSpans(
    {
      search: `trace:${traceId} has:gen_ai.operation.type`,
      fields: [...TRACE_SPAN_FIELDS],
      sorts: [{field: 'precise.start_ts', kind: 'asc'}],
      limit: 100,
      enabled: isTraceMode && !!traceId,
    },
    TRACE_DETAIL_REFERRER
  );

  const traceNodes = useMemo((): {
    nodeTraceMap: Map<string, string>;
    nodes: AITraceSpanNode[];
  } => {
    if (!spansResult.data) {
      return {nodes: [], nodeTraceMap: new Map()};
    }

    const nodeTraceMap = new Map<string, string>();
    const nodeMap = new Map<string, AITraceSpanNode>();

    const nodes = spansResult.data.map(span => {
      const apiSpan: ConversationApiSpan = {
        span_id: String(span.span_id ?? ''),
        trace: String(span.trace ?? ''),
        'span.op': String(span['span.op'] ?? ''),
        'span.description': String(span['span.description'] ?? ''),
        'span.name': span['span.name'] ? String(span['span.name']) : undefined,
        'span.status': String(span['span.status'] ?? ''),
        'precise.start_ts': Number(span['precise.start_ts'] ?? 0),
        'precise.finish_ts': Number(span['precise.finish_ts'] ?? 0),
        project: String(span.project ?? ''),
        'project.id': Number(span['project.id'] ?? 0),
        parent_span: '',
        'gen_ai.conversation.id': String(span['gen_ai.conversation.id'] ?? ''),
        'gen_ai.operation.type': String(span['gen_ai.operation.type'] ?? ''),
        'gen_ai.input.messages': span['gen_ai.input.messages'] || undefined,
        'gen_ai.output.messages': span['gen_ai.output.messages'] || undefined,
        'gen_ai.request.messages': span['gen_ai.request.messages'] || undefined,
        'gen_ai.response.text': span['gen_ai.response.text'] || undefined,
        'gen_ai.response.object': span['gen_ai.response.object'] || undefined,
        'gen_ai.tool.name': span['gen_ai.tool.name'] || undefined,
        'gen_ai.usage.total_tokens': Number(span['gen_ai.usage.total_tokens'] ?? 0),
        'gen_ai.cost.total_tokens': Number(span['gen_ai.cost.total_tokens'] ?? 0),
        'user.email': span['user.email'] || undefined,
        'user.id': span['user.id'] || undefined,
        'user.ip': span['user.ip'] || undefined,
        'user.username': span['user.username'] || undefined,
      };

      const node = createNodeFromApiSpan(apiSpan, nodeMap);
      nodeMap.set(node.id, node);
      nodeTraceMap.set(node.id, apiSpan.trace);
      return node;
    });

    return {nodes, nodeTraceMap};
  }, [spansResult.data]);

  if (isTraceMode) {
    return {
      ...traceNodes,
      isLoading: spansResult.isPending,
      error: spansResult.isError,
    };
  }

  return conversationResult;
}

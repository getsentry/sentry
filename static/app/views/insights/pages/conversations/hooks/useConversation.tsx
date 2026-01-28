import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getGenAiOperationTypeFromSpanOp} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {EAPSpanNodeDetails} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';

export interface UseConversationsOptions {
  conversationId: string;
}

/**
 * Raw span data returned from the AI conversation details endpoint
 */
interface ConversationApiSpan {
  'gen_ai.conversation.id': string;
  parent_span: string;
  'precise.finish_ts': number;
  'precise.start_ts': number;
  project: string;
  'project.id': number;
  'span.description': string;
  'span.op': string;
  'span.status': string;
  span_id: string;
  trace: string;
  'gen_ai.operation.type'?: string;
  'gen_ai.request.messages'?: string;
  'gen_ai.response.object'?: string;
  'gen_ai.response.text'?: string;
  'gen_ai.tool.name'?: string;
  'user.email'?: string;
  'user.id'?: string;
  'user.ip'?: string;
  'user.username'?: string;
}

function isGenAiSpan(span: ConversationApiSpan): boolean {
  if (span['gen_ai.operation.type']) {
    return true;
  }
  return span['span.op']?.startsWith('gen_ai.') ?? false;
}

interface UseConversationResult {
  error: boolean;
  isLoading: boolean;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
}

/**
 * Creates a node-like object from a flat API span response so existing UI
 * components (AISpanList, MessagesPanel) work without full trace fetches.
 */
function createNodeFromApiSpan(
  apiSpan: ConversationApiSpan,
  nodeMap: Map<string, AITraceSpanNode>
): AITraceSpanNode {
  const operationType =
    apiSpan['gen_ai.operation.type'] ||
    getGenAiOperationTypeFromSpanOp(apiSpan['span.op']);

  const duration = apiSpan['precise.finish_ts'] - apiSpan['precise.start_ts'];
  const value: TraceTree.EAPSpan = {
    children: [],
    duration,
    event_id: apiSpan.span_id,
    event_type: 'span',
    is_transaction: false,
    op: apiSpan['span.op'],
    description: apiSpan['span.description'],
    start_timestamp: apiSpan['precise.start_ts'],
    end_timestamp: apiSpan['precise.finish_ts'],
    project_id: apiSpan['project.id'],
    project_slug: apiSpan.project,
    parent_span_id: apiSpan.parent_span,
    profile_id: '',
    profiler_id: '',
    sdk_name: '',
    transaction: '',
    transaction_id: '',
    name: apiSpan['span.description'],
    errors: [],
    occurrences: [],
    additional_attributes: {
      [SpanFields.GEN_AI_CONVERSATION_ID]: apiSpan['gen_ai.conversation.id'],
      [SpanFields.GEN_AI_OPERATION_TYPE]: operationType ?? '',
      [SpanFields.GEN_AI_REQUEST_MESSAGES]: apiSpan['gen_ai.request.messages'] ?? '',
      [SpanFields.GEN_AI_RESPONSE_OBJECT]: apiSpan['gen_ai.response.object'] ?? '',
      [SpanFields.GEN_AI_RESPONSE_TEXT]: apiSpan['gen_ai.response.text'] ?? '',
      [SpanFields.GEN_AI_TOOL_NAME]: apiSpan['gen_ai.tool.name'] ?? '',
      [SpanFields.SPAN_STATUS]: apiSpan['span.status'],
      [SpanFields.USER_EMAIL]: apiSpan['user.email'] ?? '',
      [SpanFields.USER_ID]: apiSpan['user.id'] ?? '',
      [SpanFields.USER_IP]: apiSpan['user.ip'] ?? '',
      [SpanFields.USER_USERNAME]: apiSpan['user.username'] ?? '',
    },
  };

  const startMs = value.start_timestamp * 1e3;
  const durationMs = (value.end_timestamp - value.start_timestamp) * 1e3;
  const parentSpanId = apiSpan.parent_span;
  const errors = new Set<TraceTree.TraceError>();

  const node = {
    id: apiSpan.span_id,
    value,
    type: 'span' as const,
    extra: null,
    space: [startMs, durationMs] as [number, number],
    op: value.op,
    description: value.description,
    startTimestamp: value.start_timestamp,
    endTimestamp: value.end_timestamp,
    projectSlug: value.project_slug,
    attributes: value.additional_attributes,
    errors,
    profileId: undefined,
    profilerId: undefined,
    uniqueIssues: [] as TraceTree.TraceIssue[],

    findClosestParentTransaction: () => null,
    findParent<T>(predicate: (node: T) => boolean): T | null {
      let currentParentId: string | undefined = parentSpanId;
      while (currentParentId) {
        const parentNode = nodeMap.get(currentParentId);
        if (!parentNode) {
          break;
        }
        if (predicate(parentNode as unknown as T)) {
          return parentNode as unknown as T;
        }
        currentParentId = parentNode.value?.parent_span_id ?? undefined;
      }
      return null;
    },
    findParentEapTransaction: () => null,

    renderDetails(props: TraceTreeNodeDetailsProps<AITraceSpanNode>) {
      return <EAPSpanNodeDetails {...props} node={this as unknown as EapSpanNode} />;
    },
  };

  return node as unknown as AITraceSpanNode;
}

export function useConversation(
  conversation: UseConversationsOptions
): UseConversationResult {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/ai-conversations/$conversationId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        conversationId: conversation.conversationId,
      },
    }
  );
  const queryParams = {
    project: selection.projects,
    environment: selection.environments,
    ...normalizeDateTimeParams(selection.datetime),
  };

  const conversationQuery = useApiQuery<ConversationApiSpan[]>(
    [queryUrl, {query: queryParams}],
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!conversation.conversationId,
    }
  );

  const {nodes, nodeTraceMap} = useMemo(() => {
    if (!conversationQuery.data) {
      return {nodes: [], nodeTraceMap: new Map<string, string>()};
    }

    const traceMap = new Map<string, string>();
    const genAiSpans = conversationQuery.data.filter(isGenAiSpan);
    const nodeMap = new Map<string, AITraceSpanNode>();

    const transformedNodes = genAiSpans.map(apiSpan => {
      const node = createNodeFromApiSpan(apiSpan, nodeMap);
      nodeMap.set(node.id, node);
      traceMap.set(node.id, apiSpan.trace);
      return node;
    });

    transformedNodes.sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));

    return {nodes: transformedNodes, nodeTraceMap: traceMap};
  }, [conversationQuery.data]);

  if (!conversation.conversationId) {
    return {nodes: [], nodeTraceMap: new Map(), isLoading: false, error: false};
  }

  return {
    nodes,
    nodeTraceMap,
    isLoading: conversationQuery.isLoading,
    error: conversationQuery.isError,
  };
}

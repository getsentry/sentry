import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  InfiniteQueryObserver,
  skipToken,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import {
  ALL_ACCESS_PROJECTS,
  getDefaultPageFilterSelection,
} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {InfiniteApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MAX_PICKABLE_DAYS} from 'sentry/views/explore/conversations/settings';
import {
  getConversationUserIdentity,
  type ConversationUserIdentity,
} from 'sentry/views/explore/conversations/utils/conversationUser';
import type {TraceItemDetailsMeta} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {markScrubbedValue} from 'sentry/views/insights/pages/agents/components/scrubbedText';
import {buildAiSpanTree} from 'sentry/views/insights/pages/agents/utils/aiSpanTree';
import {isEvaluationOperation} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {isExtractionOperation} from 'sentry/views/insights/pages/agents/utils/extraction';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';

export interface UseConversationsOptions {
  conversationId: string;
  /** Fetch every page for callers that do not provide pagination controls. */
  autoFetchAll?: boolean;
  endTimestamp?: number;
  /**
   * Projects to scope the span query to, overriding the page filters. A caller
   * that is not the conversations route -- an embed rendered into some other
   * page -- knows the conversation's own project and must not inherit whatever
   * the host page happens to have selected.
   */
  projects?: number[];
  startTimestamp?: number;
}

/**
 * Raw span data returned from the AI conversation details endpoint
 */
export interface ConversationApiSpan {
  'gen_ai.conversation.id': string;
  parent_span: string;
  'precise.finish_ts': number;
  'precise.start_ts': number;
  project: string;
  'project.id': number;
  'span.name': string;
  'span.status': string;
  span_id: string;
  trace: string;
  errors?: TraceTree.EAPError[];
  'gen_ai.agent.name'?: string;
  'gen_ai.cost.total_tokens'?: number;
  'gen_ai.embeddings.input'?: string;
  'gen_ai.input.messages'?: string;
  'gen_ai.memory.query.text'?: string;
  'gen_ai.memory.record.count'?: number;
  'gen_ai.memory.record.id'?: string;
  'gen_ai.memory.records'?: string;
  'gen_ai.memory.store.id'?: string;
  'gen_ai.operation.name'?: string;
  'gen_ai.operation.type'?: string;
  'gen_ai.output.messages'?: string;
  'gen_ai.request.model'?: string;
  'gen_ai.response.model'?: string;
  'gen_ai.response.object'?: string;
  'gen_ai.system_instructions'?: string;
  'gen_ai.tool.call.arguments'?: string;
  'gen_ai.tool.call.result'?: string;
  'gen_ai.tool.call.result.size'?: number | null;
  'gen_ai.tool.name'?: string;
  'gen_ai.usage.cache_creation.input_tokens'?: number;
  'gen_ai.usage.cache_read.input_tokens'?: number;
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.input_tokens.cache_write'?: number;
  'gen_ai.usage.input_tokens.cached'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'gen_ai.usage.output_tokens.reasoning'?: number;
  'gen_ai.usage.reasoning.output_tokens'?: number;
  'gen_ai.usage.total_tokens'?: number;
  /** How PII scrubbing changed the span's string attributes, keyed by attribute. */
  meta?: TraceItemDetailsMeta;
  occurrences?: TraceTree.EAPOccurrence[];
  'span.description'?: string;
  'span.op'?: string;
  'user.email'?: string;
  'user.id'?: string;
  'user.ip'?: string;
  'user.username'?: string;
}

export interface ConversationModelUsage {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputCost: number;
  inputTokens: number;
  llmCalls: number;
  model: string | null;
  outputCost: number;
  outputTokens: number;
  reasoningTokens: number;
  totalCost: number;
  totalTokens: number;
}

export interface ConversationStats {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  endTimestamp: number;
  errorToolNames: string[];
  errors: number;
  generationDuration: number;
  inputTokens: number;
  llmCalls: number;
  outputTokens: number;
  reasoningTokens: number;
  startTimestamp: number;
  toolCalls: number;
  toolErrors: number;
  toolNames: string[];
  totalCost: number;
  totalTokens: number;
  usageByModel: ConversationModelUsage[];
}

export interface ConversationApiResponse {
  conversationId: string;
  spans: ConversationApiSpan[];
  stats: ConversationStats;
  title: string | null;
}

export type ConversationInfiniteData = InfiniteData<
  ApiResponse<ConversationApiResponse>,
  ParsedHeader | undefined
>;

interface UseConversationResult {
  canAutoFetchNextPage: boolean;
  error: boolean;
  hasNextPage: boolean;
  hasReachedPageLimit: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isNextPageError: boolean;
  loadNextPage: () => void;
  loadRemainingPages: (signal: AbortSignal) => Promise<number>;
  loadedPageCount: number;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  stats: ConversationStats | null;
  title: string | null;
  /** Who the conversation was with, from the first span that says. */
  user: ConversationUserIdentity | null;
}

/** Marks where PII scrubbing changed the span's values, see `markScrubbedValue`. */
function markScrubbedSpan(apiSpan: ConversationApiSpan): ConversationApiSpan {
  const {meta} = apiSpan;
  const operationName = apiSpan['gen_ai.operation.name'];
  // Evaluations and extractions are parsed into their own views, which render
  // their values as plain text.
  if (
    !meta ||
    isEvaluationOperation(operationName) ||
    isExtractionOperation(operationName)
  ) {
    return apiSpan;
  }
  const markedValues = Object.entries(apiSpan).flatMap(([attribute, value]) =>
    attribute in meta && typeof value === 'string'
      ? [[attribute, markScrubbedValue(attribute, value, meta, apiSpan.project)]]
      : []
  );
  return {...apiSpan, ...Object.fromEntries(markedValues)};
}

/**
 * Creates a trace node from a flat API span response so existing UI components
 * (AiSpanTimeline, MessagesPanel) work without full trace fetches. Its parent is
 * linked once all of the conversation's nodes exist.
 */
function createNodeFromApiSpan(
  apiSpan: ConversationApiSpan,
  organization: Organization
): AITraceSpanNode {
  const duration = apiSpan['precise.finish_ts'] - apiSpan['precise.start_ts'];
  const value: TraceTree.EAPSpan = {
    children: [],
    duration,
    event_id: apiSpan.span_id,
    event_type: 'span',
    is_transaction: false,
    op: apiSpan['span.name'],
    description: apiSpan['span.name'],
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
    name: apiSpan['span.name'] || '',
    errors: apiSpan.errors ?? [],
    occurrences: apiSpan.occurrences ?? [],
    additional_attributes: {
      [SpanFields.GEN_AI_CONVERSATION_ID]: apiSpan['gen_ai.conversation.id'],
      [SpanFields.GEN_AI_EMBEDDINGS_INPUT]: apiSpan['gen_ai.embeddings.input'] ?? '',
      [SpanFields.GEN_AI_INPUT_MESSAGES]: apiSpan['gen_ai.input.messages'] ?? '',
      // Recognizes evaluation, extraction and embeddings spans, which report the
      // ai_client operation type.
      [SpanFields.GEN_AI_OPERATION_NAME]: apiSpan['gen_ai.operation.name'] ?? '',
      [SpanFields.GEN_AI_OPERATION_TYPE]: apiSpan['gen_ai.operation.type'] ?? '',
      [SpanFields.GEN_AI_MEMORY_STORE_ID]: apiSpan['gen_ai.memory.store.id'] ?? '',
      [SpanFields.GEN_AI_MEMORY_QUERY_TEXT]: apiSpan['gen_ai.memory.query.text'] ?? '',
      [SpanFields.GEN_AI_MEMORY_RECORD_ID]: apiSpan['gen_ai.memory.record.id'] ?? '',
      [SpanFields.GEN_AI_MEMORY_RECORDS]: apiSpan['gen_ai.memory.records'] ?? '',
      ...(apiSpan['gen_ai.memory.record.count'] !== undefined && {
        [SpanFields.GEN_AI_MEMORY_RECORD_COUNT]: apiSpan['gen_ai.memory.record.count'],
      }),
      [SpanFields.GEN_AI_OUTPUT_MESSAGES]: apiSpan['gen_ai.output.messages'] ?? '',
      [SpanFields.GEN_AI_RESPONSE_OBJECT]: apiSpan['gen_ai.response.object'] ?? '',
      [SpanFields.GEN_AI_SYSTEM_INSTRUCTIONS]:
        apiSpan['gen_ai.system_instructions'] ?? '',
      [SpanFields.GEN_AI_REQUEST_MODEL]: apiSpan['gen_ai.request.model'] ?? '',
      [SpanFields.GEN_AI_RESPONSE_MODEL]: apiSpan['gen_ai.response.model'] ?? '',
      [SpanFields.GEN_AI_AGENT_NAME]: apiSpan['gen_ai.agent.name'] ?? '',
      [SpanFields.GEN_AI_TOOL_NAME]: apiSpan['gen_ai.tool.name'] ?? '',
      'gen_ai.tool.call.arguments': apiSpan['gen_ai.tool.call.arguments'] ?? '',
      'gen_ai.tool.call.result': apiSpan['gen_ai.tool.call.result'] ?? '',
      ...(typeof apiSpan['gen_ai.tool.call.result.size'] === 'number' && {
        'gen_ai.tool.call.result.size': apiSpan['gen_ai.tool.call.result.size'],
      }),
      ...(apiSpan['gen_ai.usage.input_tokens'] !== undefined && {
        [SpanFields.GEN_AI_USAGE_INPUT_TOKENS]: apiSpan['gen_ai.usage.input_tokens'],
      }),
      ...(apiSpan['gen_ai.usage.output_tokens'] !== undefined && {
        [SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS]: apiSpan['gen_ai.usage.output_tokens'],
      }),
      [SpanFields.GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS]:
        apiSpan['gen_ai.usage.cache_read.input_tokens'] ??
        apiSpan['gen_ai.usage.input_tokens.cached'] ??
        0,
      'gen_ai.usage.cache_creation.input_tokens':
        apiSpan['gen_ai.usage.cache_creation.input_tokens'] ??
        apiSpan['gen_ai.usage.input_tokens.cache_write'] ??
        0,
      [SpanFields.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS]:
        apiSpan['gen_ai.usage.reasoning.output_tokens'] ??
        apiSpan['gen_ai.usage.output_tokens.reasoning'] ??
        0,
      [SpanFields.GEN_AI_USAGE_TOTAL_TOKENS]: apiSpan['gen_ai.usage.total_tokens'] ?? 0,
      [SpanFields.GEN_AI_COST_TOTAL_TOKENS]: apiSpan['gen_ai.cost.total_tokens'] ?? 0,
      [SpanFields.SPAN_STATUS]: apiSpan['span.status'],
      [SpanFields.USER_EMAIL]: apiSpan['user.email'] ?? '',
      [SpanFields.USER_ID]: apiSpan['user.id'] ?? '',
      [SpanFields.USER_IP]: apiSpan['user.ip'] ?? '',
      [SpanFields.USER_USERNAME]: apiSpan['user.username'] ?? '',
    },
  };

  return new EapSpanNode(null, value, {organization});
}

/**
 * Orders the conversation's spans so that an agent is always followed by its own
 * descendants, the way the Agent Activity tab reads them off the trace tree.
 * Sorting by start time alone interleaves agents that run in parallel, which
 * separates each agent from the spans it produced.
 *
 * Spans without an ancestor in the conversation become roots. Roots and siblings
 * are ordered by start time, so reading order stays chronological at every level.
 */
function orderDepthFirst(nodes: AITraceSpanNode[]): AITraceSpanNode[] {
  return buildAiSpanTree(nodes, {
    compareSiblings: (a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0),
  }).list.map(treeNode => treeNode.node);
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
// Covers request latency and client clock drift against the API's own cutoff.
const RETENTION_CUTOFF_SLACK_MS = 10 * 60 * 1000;

/**
 * Pads the conversation's window by an hour on each side, but never starts it
 * before the API's 30-day cutoff, which rejects such requests with a 400.
 */
function getPaddedConversationWindow(
  startTimestamp: number,
  endTimestamp: number,
  now: number
) {
  const earliestStart = now - MAX_PICKABLE_DAYS * ONE_DAY_MS + RETENTION_CUTOFF_SLACK_MS;
  const paddedStart = startTimestamp - ONE_HOUR_MS;
  // Clamping a conversation that ends before the earliest start would skip it
  // entirely, so those keep their window.
  const start =
    endTimestamp > earliestStart ? Math.max(paddedStart, earliestStart) : paddedStart;
  return {
    start: new Date(start).toISOString(),
    end: new Date(endTimestamp + ONE_HOUR_MS).toISOString(),
  };
}

function buildConversationQueryParams(
  conversation: UseConversationsOptions,
  selection: PageFilters,
  now: number
) {
  const defaultPeriod = getDefaultPageFilterSelection().datetime.period;
  const hasExplicitDatetime =
    selection.datetime.start !== null ||
    (selection.datetime.period !== null && selection.datetime.period !== defaultPeriod);

  const datetimeParams =
    conversation.startTimestamp !== undefined && conversation.endTimestamp !== undefined
      ? getPaddedConversationWindow(
          conversation.startTimestamp,
          conversation.endTimestamp,
          now
        )
      : hasExplicitDatetime
        ? normalizeDateTimeParams(selection.datetime)
        : {};

  const selectedProjects = conversation.projects ?? selection.projects;
  const project = selectedProjects.length > 0 ? selectedProjects : [ALL_ACCESS_PROJECTS];

  return {project, ...datetimeParams};
}

export function buildConversationNodes(
  allSpans: ConversationApiSpan[],
  {
    organization,
    markScrubbed = false,
  }: {
    organization: Organization;
    /**
     * Marks where PII scrubbing changed the spans' values, see `markScrubbedValue`.
     * Only for nodes that are rendered by components that show the marks.
     */
    markScrubbed?: boolean;
  }
): {nodeTraceMap: Map<string, string>; nodes: AITraceSpanNode[]} {
  if (allSpans.length === 0) {
    return {nodes: [], nodeTraceMap: new Map<string, string>()};
  }

  const traceMap = new Map<string, string>();
  const genAiSpans = allSpans.filter(span => span['gen_ai.operation.type']);
  const nodeMap = new Map<string, AITraceSpanNode>();

  const transformedNodes = genAiSpans.map(apiSpan => {
    const node = createNodeFromApiSpan(
      markScrubbed ? markScrubbedSpan(apiSpan) : apiSpan,
      organization
    );
    nodeMap.set(node.id, node);
    traceMap.set(node.id, apiSpan.trace);
    return node;
  });
  // The API links each span to its closest gen_ai ancestor in the conversation.
  for (const node of transformedNodes) {
    const parentId = node.value.parent_span_id;
    node.parent = (parentId && nodeMap.get(parentId)) || null;
  }

  return {nodes: orderDepthFirst(transformedNodes), nodeTraceMap: traceMap};
}

const MAX_PAGES = 100;

export function getConversationQueryOptions(
  organization: Organization,
  conversation: UseConversationsOptions,
  selection: PageFilters,
  now = Date.now()
) {
  return apiOptions.asInfinite<ConversationApiResponse>()(
    '/organizations/$organizationIdOrSlug/agents/conversations/$conversationId/',
    {
      path: conversation.conversationId
        ? {
            organizationIdOrSlug: organization.slug,
            conversationId: conversation.conversationId,
          }
        : skipToken,
      query: buildConversationQueryParams(conversation, selection, now),
      staleTime: Infinity,
    }
  );
}

// Fetches under a separate key because each cache update re-renders every span.
async function fetchRemainingPages(
  queryClient: QueryClient,
  queryOptions: ReturnType<typeof getConversationQueryOptions>,
  signal: AbortSignal
) {
  const queryKey: InfiniteApiQueryKey = queryOptions.queryKey;
  const getLoadedData = () =>
    queryClient.getQueryData(queryKey) as ConversationInfiniteData | undefined;
  const initialData = getLoadedData();
  if (!initialData) {
    return 0;
  }

  const remainingKey = [...queryKey, {remainingPages: true}] as const;
  queryClient.removeQueries({queryKey: remainingKey, exact: true});
  const observer = new InfiniteQueryObserver(queryClient, {
    ...queryOptions,
    queryKey: remainingKey,
    initialData,
  });
  const cancelFetch = () =>
    void queryClient.cancelQueries({queryKey: remainingKey, exact: true});
  signal.addEventListener('abort', cancelFetch);

  let result = observer.getCurrentResult();
  try {
    while (
      result.hasNextPage &&
      !result.isFetchNextPageError &&
      !signal.aborted &&
      (result.data?.pages.length ?? 0) < MAX_PAGES
    ) {
      result = await observer.fetchNextPage();
    }
  } finally {
    signal.removeEventListener('abort', cancelFetch);
    observer.destroy();
  }

  // An infinite scroll fetch that is still running would overwrite this update.
  await queryClient.cancelQueries({queryKey, exact: true});
  const loadedPages = getLoadedData()?.pages.length ?? 0;
  const fetchedPages = result.data?.pages.length ?? 0;
  if (result.data && fetchedPages > loadedPages) {
    queryClient.setQueryData(queryKey, result.data);
  }
  queryClient.removeQueries({queryKey: remainingKey, exact: true});
  return Math.max(loadedPages, fetchedPages);
}

export function useConversation(
  conversation: UseConversationsOptions
): UseConversationResult {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {selection} = usePageFilters();
  // Fixed for the hook's lifetime so the retention clamp can't change the
  // query key between renders.
  const [now] = useState(Date.now);
  const queryOptions = getConversationQueryOptions(
    organization,
    conversation,
    selection,
    now
  );

  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isFetchNextPageError,
    isLoading,
    isLoadingError,
  } = useInfiniteQuery(queryOptions);

  const pageCount = data?.pages.length ?? 0;
  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isFetching) {
      void fetchNextPage({cancelRefetch: false});
    }
  }, [fetchNextPage, hasNextPage, isFetching]);

  const loadRemainingPages = (signal: AbortSignal) =>
    fetchRemainingPages(queryClient, queryOptions, signal);

  const autoFetchAll = conversation.autoFetchAll ?? true;
  const canAutoFetchNextPage = Boolean(
    hasNextPage && !isFetchNextPageError && pageCount < MAX_PAGES
  );
  const nextAutoFetchPage = autoFetchAll && canAutoFetchNextPage ? pageCount : null;

  useEffect(() => {
    if (nextAutoFetchPage !== null) {
      loadNextPage();
    }
  }, [loadNextPage, nextAutoFetchPage]);

  const allSpans = useMemo(
    () => data?.pages.flatMap(page => page.json.spans ?? []) ?? [],
    [data]
  );

  // Conversation-level fields are identical across pages; read the first page.
  const firstPage = data?.pages[0]?.json;
  const title = firstPage?.title ?? null;
  const stats = firstPage?.stats ?? null;

  const {nodes, nodeTraceMap} = useMemo(
    () => buildConversationNodes(allSpans, {organization, markScrubbed: true}),
    [allSpans, organization]
  );
  const user = useMemo(() => getConversationUserIdentity(allSpans), [allSpans]);

  if (!conversation.conversationId) {
    return {
      stats: null,
      nodes: [],
      canAutoFetchNextPage: false,
      nodeTraceMap: new Map(),
      hasNextPage: false,
      hasReachedPageLimit: false,
      isFetchingNextPage: false,
      isLoading: false,
      loadedPageCount: 0,
      loadNextPage,
      loadRemainingPages,
      isNextPageError: false,
      error: false,
      title: null,
      user: null,
    };
  }

  return {
    stats,
    nodes,
    nodeTraceMap,
    canAutoFetchNextPage,
    hasNextPage: Boolean(hasNextPage),
    hasReachedPageLimit: Boolean(hasNextPage && pageCount >= MAX_PAGES),
    isFetchingNextPage,
    isLoading: isLoading || nextAutoFetchPage !== null,
    loadedPageCount: pageCount,
    loadNextPage,
    loadRemainingPages,
    isNextPageError: isFetchNextPageError,
    error: isLoadingError || (autoFetchAll && isFetchNextPageError),
    title,
    user,
  };
}

import {useMemo} from 'react';

import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {
  getAgentRunsFilter,
  getHasAiSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/insights/pages/conversations/hooks/useConversations';

export type ConversationListMode = 'conversations' | 'traces';

const TRACES_REFERRER = 'api.insights.conversations.traces-table';

interface ConversationListResult {
  data: Conversation[];
  error: any;
  isLoading: boolean;
  pageLinks: string | undefined;
  setCursor: (cursor: string) => void;
}

interface TraceAggregation {
  llmCalls: number;
  toolCalls: number;
  totalCost: number;
  totalErrors: number;
  totalTokens: number;
}

/**
 * Extract text from a message object, handling three content formats:
 * 1. String content: {role: "user", content: "hello"}
 * 2. Content array: {role: "user", content: [{type: "text", text: "hello"}]}
 * 3. Parts array:   {role: "user", parts: [{type: "text", content: "hello"}]}
 */
function extractTextFromMessage(msg: Record<string, unknown>): string | null {
  const content = msg.content;
  if (typeof content === 'string' && content) {
    return content;
  }
  if (Array.isArray(content)) {
    const texts = content
      .filter(
        (p: Record<string, unknown>) =>
          typeof p === 'object' && p !== null && p.type === 'text'
      )
      .map((p: Record<string, unknown>) => (p.text as string) || (p.content as string))
      .filter(Boolean);
    if (texts.length > 0) {
      return texts.join('\n');
    }
  }
  const parts = msg.parts;
  if (Array.isArray(parts)) {
    const texts = parts
      .filter(
        (p: Record<string, unknown>) =>
          typeof p === 'object' && p !== null && p.type === 'text'
      )
      .map((p: Record<string, unknown>) => (p.content as string) || (p.text as string))
      .filter(Boolean);
    if (texts.length > 0) {
      return texts.join('\n');
    }
  }
  return null;
}

function parseMessages(messagesJson: string | null | undefined): unknown[] | null {
  if (!messagesJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(messagesJson);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extract the first user message from a gen_ai.input.messages or gen_ai.request.messages JSON string.
 */
function extractFirstUserMessage(messagesJson: string | null | undefined): string | null {
  const messages = parseMessages(messagesJson);
  if (!messages) {
    return null;
  }
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) {
      continue;
    }
    const record = msg as Record<string, unknown>;
    if (record.role === 'user') {
      const text = extractTextFromMessage(record);
      if (text) {
        return text;
      }
    }
  }
  return null;
}

/**
 * Extract the last assistant output from a gen_ai.output.messages JSON string.
 */
function extractLastAssistantOutput(
  messagesJson: string | null | undefined
): string | null {
  const messages = parseMessages(messagesJson);
  if (!messages) {
    return null;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (typeof msg !== 'object' || msg === null) {
      continue;
    }
    const record = msg as Record<string, unknown>;
    if (record.role === 'assistant') {
      const text = extractTextFromMessage(record);
      if (text) {
        return text;
      }
    }
  }
  return null;
}

export function useConversationList(mode: ConversationListMode): ConversationListResult {
  const {cursor, setCursor} = useTableCursor();
  const combinedQuery = useCombinedQuery(getHasAiSpansFilter());

  // -- Conversations mode --
  const conversationsResult = useConversations({enabled: mode === 'conversations'});

  // -- Traces mode --
  const tracesResult = useTraces({
    query: combinedQuery,
    sort: '-timestamp',
    keepPreviousData: true,
    cursor,
    limit: 10,
    enabled: mode === 'traces',
  });

  const traces = useMemo(() => tracesResult.data?.data ?? [], [tracesResult.data?.data]);
  const hasTraces = traces.length > 0 && mode === 'traces';
  const traceFilter = `trace:[${traces.map(t => `"${t.trace}"`).join(',')}]`;

  // Aggregation: LLM calls, tool calls, tokens, cost per trace
  const spansRequest = useSpans(
    {
      search: `${getAgentRunsFilter({negated: true})} ${traceFilter}`,
      fields: [
        'trace',
        'count_if(gen_ai.operation.type,equals,ai_client)',
        'count_if(gen_ai.operation.type,equals,tool)',
        'sum(gen_ai.usage.total_tokens)',
        'sum(gen_ai.cost.total_tokens)',
      ],
      limit: traces.length,
      enabled: hasTraces,
      samplingMode: SAMPLING_MODE.HIGH_ACCURACY,
      extrapolationMode: 'none',
    },
    TRACES_REFERRER
  );

  // Error counts per trace
  const traceErrorRequest = useSpans(
    {
      search: `span.status:internal_error ${traceFilter} has:gen_ai.operation.name`,
      fields: ['trace', 'count(span.duration)'],
      limit: traces.length,
      enabled: hasTraces,
    },
    TRACES_REFERRER
  );

  // Enrichment: tool names and user data per trace
  const enrichmentRequest = useSpans(
    {
      search: `has:gen_ai.operation.type ${traceFilter}`,
      fields: [
        'trace',
        'gen_ai.operation.type',
        'gen_ai.tool.name',
        'user.id',
        'user.email',
        'user.username',
        'user.ip',
        'timestamp',
      ],
      sorts: [{field: 'timestamp', kind: 'asc'}],
      limit: 100,
      enabled: hasTraces,
    },
    TRACES_REFERRER
  );

  // First input / last output: ai_client spans with message fields
  const ioRequest = useSpans(
    {
      search: `gen_ai.operation.type:ai_client ${traceFilter}`,
      fields: [
        'trace',
        'gen_ai.input.messages',
        'gen_ai.output.messages',
        'gen_ai.request.messages',
        'gen_ai.response.text',
        'timestamp',
      ],
      sorts: [{field: 'timestamp', kind: 'asc'}],
      limit: 100,
      enabled: hasTraces,
    },
    TRACES_REFERRER
  );

  // Process aggregation data
  const spanDataMap = useMemo(() => {
    if (!spansRequest.data || !traceErrorRequest.data) {
      return {} as Record<string, TraceAggregation>;
    }
    const errors = traceErrorRequest.data.reduce(
      (acc, span) => {
        acc[span.trace] = Number(span['count(span.duration)'] ?? 0);
        return acc;
      },
      {} as Record<string, number>
    );

    return spansRequest.data.reduce(
      (acc, span) => {
        acc[span.trace] = {
          llmCalls: Number(span['count_if(gen_ai.operation.type,equals,ai_client)'] ?? 0),
          toolCalls: Number(span['count_if(gen_ai.operation.type,equals,tool)'] ?? 0),
          totalTokens: Number(span['sum(gen_ai.usage.total_tokens)'] ?? 0),
          totalCost: Number(span['sum(gen_ai.cost.total_tokens)'] ?? 0),
          totalErrors: Number(errors[span.trace] ?? 0),
        };
        return acc;
      },
      {} as Record<string, TraceAggregation>
    );
  }, [spansRequest.data, traceErrorRequest.data]);

  // Process enrichment: tool names + user per trace
  const enrichmentMap = useMemo(() => {
    const result = new Map<
      string,
      {toolNames: Set<string>; user: ConversationUser | null}
    >();
    if (!enrichmentRequest.data) {
      return result;
    }
    for (const span of enrichmentRequest.data) {
      const traceId = span.trace;
      if (!result.has(traceId)) {
        result.set(traceId, {toolNames: new Set(), user: null});
      }
      const entry = result.get(traceId)!;

      if (span['gen_ai.operation.type'] === 'tool' && span['gen_ai.tool.name']) {
        entry.toolNames.add(span['gen_ai.tool.name']);
      }

      if (!entry.user) {
        const email = span['user.email'] || null;
        const userId = span['user.id'] || null;
        const username = span['user.username'] || null;
        const ip = span['user.ip'] || null;
        if (email || userId || username || ip) {
          entry.user = {
            id: userId,
            email,
            username,
            ip_address: ip,
          };
        }
      }
    }
    return result;
  }, [enrichmentRequest.data]);

  // Process IO: first input and last output per trace (data sorted by timestamp asc)
  const ioMap = useMemo(() => {
    const result = new Map<
      string,
      {firstInput: string | null; lastOutput: string | null}
    >();
    if (!ioRequest.data) {
      return result;
    }

    for (const span of ioRequest.data) {
      const traceId = span.trace;
      if (!result.has(traceId)) {
        result.set(traceId, {firstInput: null, lastOutput: null});
      }
      const entry = result.get(traceId)!;

      // First input: take from the earliest span that has one
      if (!entry.firstInput) {
        entry.firstInput =
          extractFirstUserMessage(span['gen_ai.input.messages']) ??
          extractFirstUserMessage(span['gen_ai.request.messages']);
      }

      // Last output: keep overwriting with later spans (data sorted asc)
      const output =
        extractLastAssistantOutput(span['gen_ai.output.messages']) ??
        (span['gen_ai.response.text'] || null);
      if (output) {
        entry.lastOutput = output;
      }
    }

    return result;
  }, [ioRequest.data]);

  // Assemble final Conversation[] from trace data
  const tracesAsConversations = useMemo((): Conversation[] => {
    return traces.map(trace => {
      const traceId = trace.trace;
      const agg = spanDataMap[traceId];
      const enrichment = enrichmentMap.get(traceId);
      const io = ioMap.get(traceId);

      return {
        conversationId: traceId,
        duration: trace.duration,
        startTimestamp: trace.start,
        endTimestamp: trace.start + trace.duration,
        errors: agg?.totalErrors ?? 0,
        firstInput: io?.firstInput ?? null,
        lastOutput: io?.lastOutput ?? null,
        llmCalls: agg?.llmCalls ?? 0,
        toolCalls: agg?.toolCalls ?? 0,
        toolErrors: 0,
        toolNames: [...(enrichment?.toolNames ?? [])].sort(),
        totalCost: agg?.totalCost ?? null,
        totalTokens: agg?.totalTokens ?? 0,
        traceCount: 1,
        traceIds: [traceId],
        user: enrichment?.user ?? null,
      };
    });
  }, [traces, spanDataMap, enrichmentMap, ioMap]);

  if (mode === 'conversations') {
    return {
      data: conversationsResult.data,
      isLoading: conversationsResult.isLoading,
      error: conversationsResult.error,
      pageLinks: conversationsResult.pageLinks,
      setCursor: conversationsResult.setCursor,
    };
  }

  return {
    data: tracesAsConversations,
    isLoading: tracesResult.isPending,
    error: tracesResult.error,
    pageLinks: tracesResult.getResponseHeader?.('Link') ?? undefined,
    setCursor,
  };
}

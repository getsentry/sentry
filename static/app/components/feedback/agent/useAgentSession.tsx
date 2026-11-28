import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

/** How far back from the report we look for the agent's tool calls. */
export const SESSION_LOOKBACK_MS = 30 * 60_000;
/** The report itself is a tool call, and ingestion clocks drift a little. */
const SESSION_LOOKAHEAD_MS = 2 * 60_000;
const MAX_TOOL_CALLS = 50;

/**
 * Tool arguments are recorded as one span attribute each. These are the ones
 * that best say what the agent was asking for.
 */
const ARGUMENT_KEYS = [
  'query',
  'naturallanguagequery',
  'url',
  'issueid',
  'eventid',
  'traceid',
  'resourceid',
] as const;

type SpanRow = Record<string, string | number | null> & {
  id: string;
  'mcp.tool.name': string;
  'mcp.tool.result.content': string | null;
  'precise.start_ts': number;
  'span.duration': number;
  'span.status': string;
  trace: string;
};

type LogRow = {
  errorMessage: string | null;
  message: string;
  severity: string;
  timestamp: string;
  trace: string;
};

export interface AgentToolCallLog {
  detail: string | null;
  message: string;
  severity: string;
}

export interface AgentToolCall {
  argument: {key: string; value: string} | null;
  durationMs: number;
  /** Why the call failed, as the tool told the agent. */
  error: string | null;
  failed: boolean;
  id: string;
  /** The agent had already failed with this tool and is trying it again. */
  isRetry: boolean;
  logs: AgentToolCallLog[];
  /** For a failed call: whether a later call to the same tool succeeded. */
  recovered: boolean;
  result: string | null;
  startMs: number;
  tool: string;
  traceId: string;
}

interface Props {
  /** When the feedback was submitted. */
  feedbackTime: string;
  projectId: string | undefined;
  userId: string | undefined;
}

export function getSessionWindow(feedbackTime: string) {
  const reportedAt = new Date(feedbackTime).getTime();
  return {
    start: new Date(reportedAt - SESSION_LOOKBACK_MS).toISOString(),
    end: new Date(reportedAt + SESSION_LOOKAHEAD_MS).toISOString(),
  };
}

export function getSessionSpanQuery(userId: string) {
  return `user.id:${userId} span.op:mcp.server has:mcp.tool.name`;
}

/**
 * Rebuilds what the agent did before it reported feedback.
 *
 * Every tool call is its own trace, so the feedback's trace is empty. The
 * calls are tied together by the user they ran as, and each call's logs hang
 * off that call's trace.
 */
export function useAgentSession({feedbackTime, projectId, userId}: Props) {
  const organization = useOrganization();
  const enabled = Boolean(userId && projectId);
  const {start, end} = getSessionWindow(feedbackTime);

  const spans = useQuery(
    apiOptions.as<{data: SpanRow[]}>()('/organizations/$organizationIdOrSlug/events/', {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: 'spans',
        referrer: 'api.feedback.agent-session',
        project: projectId,
        start,
        end,
        field: [
          'id',
          'trace',
          'timestamp',
          'precise.start_ts',
          'span.duration',
          'span.status',
          'mcp.tool.name',
          'mcp.tool.result.content',
          ...ARGUMENT_KEYS.map(key => `mcp.request.argument.${key}`),
        ],
        query: userId ? getSessionSpanQuery(userId) : undefined,
        sort: '-timestamp',
        per_page: MAX_TOOL_CALLS,
      },
      staleTime: 60_000,
    })
  );

  const traceIds = useMemo(
    () => spans.data?.data.map(row => row.trace) ?? [],
    [spans.data]
  );

  const logs = useQuery(
    apiOptions.as<{data: LogRow[]}>()('/organizations/$organizationIdOrSlug/events/', {
      path: traceIds.length ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: 'logs',
        referrer: 'api.feedback.agent-session-logs',
        project: projectId,
        start,
        end,
        field: ['timestamp', 'message', 'severity', 'trace', 'errorMessage'],
        query: `trace:[${traceIds.join(',')}]`,
        sort: 'timestamp',
        per_page: 100,
      },
      staleTime: 60_000,
    })
  );

  const toolCalls = useMemo<AgentToolCall[]>(() => {
    const logsByTrace = Map.groupBy(logs.data?.data ?? [], row => row.trace);

    const calls: AgentToolCall[] = (spans.data?.data ?? [])
      .map(row => {
        const argumentKey = ARGUMENT_KEYS.find(key => row[`mcp.request.argument.${key}`]);
        const failed = row['span.status'] !== 'ok';
        const result = row['mcp.tool.result.content'];
        return {
          id: row.id,
          traceId: row.trace,
          tool: row['mcp.tool.name'],
          startMs: row['precise.start_ts'] * 1000,
          durationMs: row['span.duration'],
          failed,
          error: failed && result ? summarizeError(result) : null,
          isRetry: false,
          recovered: false,
          result,
          argument: argumentKey
            ? {
                key: argumentKey,
                value: unquote(String(row[`mcp.request.argument.${argumentKey}`])),
              }
            : null,
          logs: (logsByTrace.get(row.trace) ?? []).map(log => ({
            severity: log.severity,
            message: log.message,
            detail: log.errorMessage,
          })),
        };
      })
      .toReversed();

    // A tool that failed and was called again is the agent working around the
    // failure. One that never succeeded afterwards is where it got stuck.
    const unrecovered = new Map<string, AgentToolCall[]>();
    for (const call of calls) {
      const pending = unrecovered.get(call.tool);
      call.isRetry = Boolean(pending?.length);
      if (call.failed) {
        unrecovered.set(call.tool, [...(pending ?? []), call]);
      } else if (pending) {
        pending.forEach(failedCall => {
          failedCall.recovered = true;
        });
        unrecovered.delete(call.tool);
      }
    }

    return calls;
  }, [spans.data, logs.data]);

  return {
    toolCalls,
    isPending: enabled && spans.isPending,
    isError: spans.isError,
    isTruncated: (spans.data?.data.length ?? 0) >= MAX_TOOL_CALLS,
  };
}

/**
 * Tool errors come back as markdown: a bold heading such as `**Input Error**`,
 * a stock opening sentence, what actually went wrong, then stock advice to try
 * again. Only the middle is worth a line of its own.
 */
function summarizeError(result: string) {
  const lines = result
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const heading = lines.find(line => /^\*\*.+\*\*$/.test(line));
  const body = lines.filter(line => line !== heading);
  const detail = body.length > 2 ? body.slice(1, -1).join(' ') : body[0];
  return [heading?.replaceAll('**', ''), detail].filter(Boolean).join(' — ') || null;
}

/** Argument values are stored JSON-encoded, so strings arrive wrapped in quotes. */
export function unquote(value: string) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

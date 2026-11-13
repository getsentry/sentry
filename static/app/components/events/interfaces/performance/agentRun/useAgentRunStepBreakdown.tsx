import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * How many of the issue's most recent events to look at.
 */
const SAMPLED_EVENTS = 50;
export const STATS_PERIOD = '14d';

interface ErrorRow {
  trace: string;
  'trace.span': string;
}

interface SpanRow {
  id: string;
  'span.op': string;
  [SpanFields.GEN_AI_TOOL_NAME]?: string;
}

export interface AgentRunStepCount {
  count: number;
  /**
   * Span ids of the steps, for linking to them in Explore.
   */
  spanIds: string[];
  /**
   * The tool name for tool calls, otherwise the span op (e.g. `gen_ai.chat`).
   */
  step: string;
}

export interface AgentRunStepBreakdown {
  /**
   * Events whose span was found and was an AI step. Spans are sampled, so this is
   * usually lower than `sampledEvents`.
   */
  matchedEvents: number;
  sampledEvents: number;
  /**
   * Sorted by count, highest first.
   */
  steps: AgentRunStepCount[];
  traceIds: string[];
}

function getStep(span: SpanRow): string | undefined {
  const toolName = span[SpanFields.GEN_AI_TOOL_NAME];
  if (toolName) {
    return toolName;
  }
  return span['span.op']?.startsWith('gen_ai.') ? span['span.op'] : undefined;
}

export function getAgentRunStepBreakdown(
  errors: ErrorRow[],
  spans: SpanRow[]
): AgentRunStepBreakdown {
  const spansById = new Map(spans.map(span => [span.id, span]));
  const steps = new Map<string, AgentRunStepCount>();
  let matchedEvents = 0;

  for (const error of errors) {
    const span = spansById.get(error['trace.span']);
    const step = span ? getStep(span) : undefined;
    if (!span || !step) {
      continue;
    }
    matchedEvents++;
    const entry = steps.get(step) ?? {step, count: 0, spanIds: []};
    entry.count++;
    entry.spanIds.push(span.id);
    steps.set(step, entry);
  }

  return {
    sampledEvents: errors.length,
    matchedEvents,
    steps: [...steps.values()].toSorted((a, b) => b.count - a.count),
    traceIds: [...new Set(errors.map(error => error.trace))],
  };
}

/**
 * Counts which agent step (tool call or LLM call) the issue's recent events were
 * raised in, by looking up each event's active span.
 */
export function useAgentRunStepBreakdown(event: Event, {enabled}: {enabled: boolean}) {
  const organization = useOrganization();
  const groupId = event.groupID;

  const errorsQuery = useQuery(
    apiOptions.as<{data: ErrorRow[]}>()('/organizations/$organizationIdOrSlug/events/', {
      path: enabled && groupId ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.ERRORS,
        field: ['trace', 'trace.span', 'timestamp'],
        query: `issue.id:${groupId} has:trace.span`,
        project: event.projectID,
        sort: '-timestamp',
        statsPeriod: STATS_PERIOD,
        per_page: SAMPLED_EVENTS,
        referrer: 'issue_details.agent_run.recent_errors',
      },
      staleTime: 60_000,
    })
  );

  const errors = useMemo(
    () => (errorsQuery.data?.data ?? []).filter(row => row.trace && row['trace.span']),
    [errorsQuery.data]
  );

  const spansQuery = useQuery(
    apiOptions.as<{data: SpanRow[]}>()('/organizations/$organizationIdOrSlug/events/', {
      path: errors.length ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.SPANS,
        field: ['id', 'span.op', SpanFields.GEN_AI_TOOL_NAME],
        // Span ids alone are not selective enough to find the spans, so also filter
        // by trace.
        query: `trace:[${[...new Set(errors.map(row => row.trace))].join(',')}] id:[${errors
          .map(row => row['trace.span'])
          .join(',')}]`,
        project: event.projectID,
        statsPeriod: STATS_PERIOD,
        per_page: SAMPLED_EVENTS,
        referrer: 'issue_details.agent_run.recent_error_spans',
      },
      staleTime: 60_000,
    })
  );

  return useMemo(() => {
    if (!spansQuery.data) {
      return null;
    }
    return getAgentRunStepBreakdown(errors, spansQuery.data.data);
  }, [errors, spansQuery.data]);
}

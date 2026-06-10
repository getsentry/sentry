import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

import type {
  AskSeerSearchItems,
  NoneOfTheseItem,
  QueryTokensProps,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

function extractErrorReason(err: Error): string {
  if (err instanceof RequestError) {
    const detail = err.responseJSON?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail?.message) {
      return detail.message;
    }
  }
  return err.message;
}

export function trackAiQueryOutcome({
  dataset,
  mode,
  orgSlug,
  referrer,
  resultCount,
  runId,
  error = false,
}: {
  dataset: 'spans' | 'errors' | 'logs' | 'tracemetrics' | 'issues';
  mode: Mode | 'samples' | 'aggregate';
  orgSlug: string;
  referrer: string;
  resultCount: number;
  runId: number | string;
  error?: string | boolean | Error;
}) {
  const outcome = error
    ? 'error_on_load'
    : resultCount > 0
      ? 'has_results'
      : 'empty_results';
  const errorReason =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? extractErrorReason(error)
        : undefined;
  const attributes = {
    dataset,
    mode: mode.toString(),
    org_slug: orgSlug,
    referrer,
    run_id: runId,
    outcome,
    error_reason: errorReason,
  };

  Sentry.logger.info('assisted_query.outcome', {
    ...attributes,
    result_count: resultCount,
  });
  Sentry.metrics.distribution('assisted_query.outcome', resultCount, {attributes});
}

export function isNoneOfTheseItem(
  item: AskSeerSearchItems<any>
): item is NoneOfTheseItem {
  return item.key === 'none-of-these';
}

/**
 * Returns the agent's expanded project scope to apply when it broadened beyond
 * the user's selection (Seer always returns a superset). Returns `undefined`
 * when there's no expansion, so the "Projects" chip stays hidden and the user's
 * selection is left untouched.
 */
export function getExpandedProjectIds(
  returnedProjectIds: number[] | null | undefined,
  selectedProjectIds: number[]
): number[] | undefined {
  if (!returnedProjectIds || returnedProjectIds.length === 0) {
    return undefined;
  }
  const selectedSet = new Set(selectedProjectIds);
  const hasExtraProjects = returnedProjectIds.some(id => !selectedSet.has(id));
  return hasExtraProjects ? returnedProjectIds : undefined;
}

function formatToken(token: string): string {
  const isNegated = token.startsWith('!') && token.includes(':');
  const actualToken = isNegated ? token.slice(1) : token;

  const operators = [
    [':>=', 'greater than or equal to'],
    [':<=', 'less than or equal to'],
    [':!=', 'not'],
    [':>', 'greater than'],
    [':<', 'less than'],
    ['>=', 'greater than or equal to'],
    ['<=', 'less than or equal to'],
    ['!=', 'not'],
    ['!:', 'not'],
    ['>', 'greater than'],
    ['<', 'less than'],
    [':', ''],
  ] as const;

  for (const [op, desc] of operators) {
    if (actualToken.includes(op)) {
      const [key, value] = actualToken.split(op);
      const cleanKey = key?.trim() || '';
      const cleanVal = value?.trim() || '';

      const negation = isNegated ? 'not ' : '';
      const description = desc ? `${negation}${desc}` : negation ? 'not' : '';

      // Special case: avoid "is is unresolved" for fields like "is:unresolved"
      if (cleanKey.toLowerCase() === 'is') {
        return `is ${negation}${cleanVal}`.replace(/\s+/g, ' ').trim();
      }

      return `${cleanKey} is ${description} ${cleanVal}`.replace(/\s+/g, ' ').trim();
    }
  }

  return token;
}

export function formatQueryToNaturalLanguage(query: string): string {
  if (!query.trim()) {
    return '';
  }
  const tokens = query.match(/(?:[^\s"]|"[^"]*")+/g) || [];
  const formattedTokens = tokens.map(formatToken);

  const formattedQuery = formattedTokens.reduce((result, token, index) => {
    if (index === 0) {
      return token;
    }

    const currentOriginalToken = tokens[index] || '';
    const prevOriginalToken = tokens[index - 1] || '';

    const isLogicalOp = token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR';
    const prevIsLogicalOp =
      formattedTokens[index - 1]?.toUpperCase() === 'AND' ||
      formattedTokens[index - 1]?.toUpperCase() === 'OR';

    if (isLogicalOp || prevIsLogicalOp) {
      return `${result} ${token}`;
    }

    const isCurrentFilter = /[:>=<!]/.test(currentOriginalToken);
    const isPrevFilter = /[:>=<!]/.test(prevOriginalToken);

    if (isCurrentFilter && isPrevFilter) {
      return `${result}, ${token}`;
    }

    return `${result} ${token}`;
  }, '');

  // add a space at the end of the query to give space for the cursor
  return `${formattedQuery} `;
}

/**
 * Formats a UTC date range for display.
 */
export function formatDateRange(start: string, end: string, separator = ' to '): string {
  const startMoment = moment.utc(start);
  const endMoment = moment.utc(end);

  // Check if times are at midnight (date-only range)
  const startIsMidnight =
    startMoment.hours() === 0 &&
    startMoment.minutes() === 0 &&
    startMoment.seconds() === 0;
  const endIsMidnight =
    endMoment.hours() === 0 && endMoment.minutes() === 0 && endMoment.seconds() === 0;
  const endIsEndOfDay =
    endMoment.hours() === 23 && endMoment.minutes() === 59 && endMoment.seconds() === 59;

  // Use date-only format if both are midnight or end of day
  const useDateOnly = startIsMidnight && (endIsMidnight || endIsEndOfDay);

  const dateFormat = 'MMM D, YYYY';
  const dateTimeFormat = 'MMM D, YYYY h:mm A';

  const formatStr = useDateOnly ? dateFormat : dateTimeFormat;

  const startFormatted = startMoment.format(formatStr);
  const endFormatted = endMoment.format(formatStr);

  return `${startFormatted}${separator}${endFormatted}`;
}

export function generateQueryTokensString(args: QueryTokensProps): string {
  const parts = [];

  if (args?.query) {
    const formattedFilter = formatQueryToNaturalLanguage(args.query.trim());
    parts.push(`Filter is '${formattedFilter}'`);
  }

  if (args?.visualizations && args.visualizations.length > 0) {
    const vizParts = args.visualizations.flatMap(visualization =>
      visualization.yAxes.map(yAxis => yAxis)
    );
    if (vizParts.length > 0) {
      const vizText = vizParts.length === 1 ? vizParts[0] : vizParts.join(', ');
      parts.push(`visualizations are '${vizText}'`);
    }
  }

  if (args?.interval) {
    parts.push(`interval is '${args.interval}'`);
  }

  if (args?.groupBys && args.groupBys.length > 0) {
    const groupByText =
      args.groupBys.length === 1 ? args.groupBys[0] : args.groupBys.join(', ');
    parts.push(`groupBys are '${groupByText}'`);
  }

  // Prefer absolute date range over statsPeriod
  if (args?.start && args?.end) {
    parts.push(`time range is '${formatDateRange(args.start, args.end)}'`);
  } else if (args?.statsPeriod && args.statsPeriod.length > 0) {
    parts.push(`time range is '${args?.statsPeriod}'`);
  }

  if (args?.sort && args.sort.length > 0) {
    const sortText =
      args?.sort[0] === '-' ? `${args?.sort.slice(1)} Desc` : `${args?.sort} Asc`;
    parts.push(`sort is '${sortText}'`);
  }

  if (args?.expandedProjectIds && args.expandedProjectIds.length > 0) {
    const count = args.expandedProjectIds.length;
    parts.push(`search expanded to ${count} ${count === 1 ? 'project' : 'projects'}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No query parameters set';
}

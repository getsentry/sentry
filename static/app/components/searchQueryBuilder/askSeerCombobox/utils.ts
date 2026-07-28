import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {
  AskSeerSearchItems,
  NoneOfTheseItem,
  QueryTokensProps,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {
  BooleanOperator,
  parseSearch,
  TermOperator,
  Token,
  type WildcardOperator,
  wildcardOperators,
  WildcardOperators,
} from 'sentry/components/searchSyntax/parser';
import type {Project} from 'sentry/types/project';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';

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

/**
 * Whether the query contains any `OR` boolean operator (including ones nested
 * inside parenthesized groups). When it does, we skip moving `project:` to the
 * page-level selector, since a project term could be scoped to one branch of the
 * disjunction (e.g. `(project:a x) OR (project:b y)`) and lifting it would change
 * the query's meaning. `flattenParenGroups` surfaces `OR`s nested in groups.
 */
function queryHasOr(query: string): boolean {
  const parsed = parseSearch(query, {flattenParenGroups: true});
  if (!parsed) {
    return false;
  }
  return parsed.some(
    token => token.type === Token.LOGIC_BOOLEAN && token.value === BooleanOperator.OR
  );
}

export interface SeerProjectSelection {
  /**
   * Project IDs to apply to the page-level project selector, or `undefined` to
   * leave the current selection untouched.
   */
  projectIds: number[] | undefined;
  /** The query with any resolved `project`/`project.id` filter removed. */
  query: string;
}

/**
 * Seer scopes a query to specific projects by putting a `project:`/`project.id:`
 * filter in the returned query string. Project is a page-level filter owned by
 * the project selector, so pull those tokens out and resolve them to project IDs
 * to apply to the selector instead of leaving them duplicated in the search bar.
 *
 * `project:` values are resolved by slug (falling back to a numeric id);
 * `project.id:` values are taken as ids directly. This is all-or-nothing: if any
 * project value can't be resolved to a known project, or the query contains an
 * `OR` (where a project term could be scoped to one branch rather than a
 * top-level AND), the whole filter is left in the query untouched and the
 * selection is unchanged, rather than changing the query's meaning. Falls back to
 * `expandedProjectIds` (the scope Seer broadened to) only when the query has no
 * project filter at all. Returns `projectIds: undefined` when neither is present.
 */
export function resolveSeerProjectSelection(
  query: string,
  projects: Project[],
  expandedProjectIds?: number[]
): SeerProjectSelection {
  const search = new MutableSearch(query);
  const slugToId = new Map(projects.map(project => [project.slug, project.id]));

  const projectValues = search.getFilterValues('project');
  const projectIdValues = search.getFilterValues('project.id');

  const resolvedIds: number[] = [];
  let allResolved = true;
  for (const value of projectValues) {
    const id = slugToId.get(value) ?? (/^\d+$/.test(value) ? value : undefined);
    if (id === undefined) {
      allResolved = false;
    } else {
      resolvedIds.push(Number(id));
    }
  }
  for (const value of projectIdValues) {
    if (/^\d+$/.test(value)) {
      resolvedIds.push(Number(value));
    } else {
      allResolved = false;
    }
  }

  if (projectValues.length > 0 || projectIdValues.length > 0) {
    // Only move the filter to the selector when every project value resolves and
    // the query has no OR. Otherwise leave the whole filter in the query untouched:
    // removeFilter drops every value for the key, so lifting would silently drop an
    // unresolvable value or change the meaning of an OR branch
    // (e.g. `(project:a x) OR (project:b y)`).
    if (allResolved && !queryHasOr(query)) {
      search.removeFilter('project');
      search.removeFilter('project.id');
      return {
        projectIds: Array.from(new Set(resolvedIds)),
        query: search.formatString(),
      };
    }
    return {projectIds: undefined, query};
  }

  return {
    projectIds: expandedProjectIds?.length ? expandedProjectIds : undefined,
    query,
  };
}

export function getCrossEventFilterQuery(crossEvent: CrossEvent): string {
  if (crossEvent.type !== 'metrics') {
    return crossEvent.query;
  }

  return [
    `${TraceMetricKnownFieldKey.METRIC_NAME}:${crossEvent.metric.name}`,
    crossEvent.query,
  ]
    .filter(Boolean)
    .join(' ');
}

export function normalizeSeerDateTimeParams({
  start,
  end,
  statsPeriod,
}: Pick<QueryTokensProps, 'start' | 'end' | 'statsPeriod'>): Pick<
  QueryTokensProps,
  'start' | 'end' | 'statsPeriod'
> {
  const normalized = normalizeDateTimeParams(
    {start, end, statsPeriod},
    {allowEmptyPeriod: true}
  );

  return {
    start: normalized.start,
    end: normalized.end,
    statsPeriod: normalized.statsPeriod ?? undefined,
  };
}

const NEGATED_WILDCARD_OPERATOR_LABELS: Partial<Record<WildcardOperator, string>> = {
  [TermOperator.CONTAINS]: OP_LABELS[TermOperator.DOES_NOT_CONTAIN],
  [TermOperator.STARTS_WITH]: OP_LABELS[TermOperator.DOES_NOT_START_WITH],
  [TermOperator.ENDS_WITH]: OP_LABELS[TermOperator.DOES_NOT_END_WITH],
};

function getWildcardOperatorLabel(
  operator: WildcardOperator,
  isNegated: boolean
): string {
  if (isNegated) {
    return NEGATED_WILDCARD_OPERATOR_LABELS[operator] ?? `not ${OP_LABELS[operator]}`;
  }

  return OP_LABELS[operator];
}

function formatWildcardToken(token: string, isNegated: boolean): string | null {
  for (const operator of wildcardOperators) {
    const operatorIndex = token.indexOf(operator);

    if (operatorIndex === -1) {
      continue;
    }

    const key = token.slice(0, operatorIndex).replace(/:$/, '').trim();
    const value = token.slice(operatorIndex + operator.length).trim();
    const description = getWildcardOperatorLabel(operator, isNegated);

    return `${key} ${description} ${value}`.replace(/\s+/g, ' ').trim();
  }

  return null;
}

function formatToken(token: string): string {
  const isNegated = token.startsWith('!') && token.includes(':');
  const actualToken = isNegated ? token.slice(1) : token;
  const wildcardToken = formatWildcardToken(actualToken, isNegated);

  if (wildcardToken) {
    return wildcardToken;
  }

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

/**
 * Splits a query on whitespace while keeping quoted phrases ("a b") and
 * bracketed lists ([a, b]) intact, so `key:"a b"` and `key:[a, b]` each stay a
 * single token even with internal spaces. Shared by the format/parse pair below.
 */
function tokenize(input: string): string[] {
  return input.match(/(?:"[^"]*"|\[[^\]]*\]|[^\s"])+/g) ?? [];
}

export function formatQueryToNaturalLanguage(query: string): string {
  if (!query.trim()) {
    return '';
  }
  const tokens = tokenize(query);
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
 * Every operator phrase {@link formatQueryToNaturalLanguage} can emit (plus the
 * bare symbolic comparators users type themselves), mapped back to the ESQ
 * filter it represents. A humanized filter always reads
 * `<key> <phrase> <value>`, so this table is the whole inverse grammar.
 *
 * Order only matters where one phrase is a prefix of another: the longer
 * phrase must come first ("is not greater than" before "is not" before "is").
 */
const FILTER_PHRASES: ReadonlyArray<{
  esq: (key: string, value: string) => string;
  phrase: string;
}> = [
  // Prose comparators: "<key> is [not] greater than <value>"
  {
    phrase: 'is not greater than or equal to',
    esq: (k, v) => `!${k}:${TermOperator.GREATER_THAN_EQUAL}${v}`,
  },
  {
    phrase: 'is not less than or equal to',
    esq: (k, v) => `!${k}:${TermOperator.LESS_THAN_EQUAL}${v}`,
  },
  {
    phrase: 'is greater than or equal to',
    esq: (k, v) => `${k}:${TermOperator.GREATER_THAN_EQUAL}${v}`,
  },
  {
    phrase: 'is less than or equal to',
    esq: (k, v) => `${k}:${TermOperator.LESS_THAN_EQUAL}${v}`,
  },
  {
    phrase: 'is not greater than',
    esq: (k, v) => `!${k}:${TermOperator.GREATER_THAN}${v}`,
  },
  {phrase: 'is not less than', esq: (k, v) => `!${k}:${TermOperator.LESS_THAN}${v}`},
  {phrase: 'is greater than', esq: (k, v) => `${k}:${TermOperator.GREATER_THAN}${v}`},
  {phrase: 'is less than', esq: (k, v) => `${k}:${TermOperator.LESS_THAN}${v}`},
  // Wildcards use the wildcard markers the builder parses back into a proper
  // chip (CONTAINS / STARTS_WITH / ENDS_WITH). Negation is the `!` prefix — the
  // DoesNot* markers are display-only and aren't valid query input.
  {
    phrase: 'does not contain',
    esq: (k, v) => `!${k}:${WildcardOperators.CONTAINS}${v}`,
  },
  {
    phrase: 'does not start with',
    esq: (k, v) => `!${k}:${WildcardOperators.STARTS_WITH}${v}`,
  },
  {
    phrase: 'does not end with',
    esq: (k, v) => `!${k}:${WildcardOperators.ENDS_WITH}${v}`,
  },
  {phrase: 'contains', esq: (k, v) => `${k}:${WildcardOperators.CONTAINS}${v}`},
  {phrase: 'starts with', esq: (k, v) => `${k}:${WildcardOperators.STARTS_WITH}${v}`},
  {phrase: 'ends with', esq: (k, v) => `${k}:${WildcardOperators.ENDS_WITH}${v}`},
  // Plain equality: "<key> is [not] <value>"
  {phrase: 'is not', esq: (k, v) => `!${k}:${v}`},
  {phrase: 'is', esq: (k, v) => `${k}:${v}`},
  // Symbolic comparators follow the key directly, with no "is":
  // "span.duration > 100ms" -> span.duration:>100ms
  {
    phrase: TermOperator.GREATER_THAN_EQUAL,
    esq: (k, v) => `${k}:${TermOperator.GREATER_THAN_EQUAL}${v}`,
  },
  {
    phrase: TermOperator.LESS_THAN_EQUAL,
    esq: (k, v) => `${k}:${TermOperator.LESS_THAN_EQUAL}${v}`,
  },
  {
    phrase: TermOperator.GREATER_THAN,
    esq: (k, v) => `${k}:${TermOperator.GREATER_THAN}${v}`,
  },
  {phrase: TermOperator.LESS_THAN, esq: (k, v) => `${k}:${TermOperator.LESS_THAN}${v}`},
];

function valueAt(words: string[], index: number): string | undefined {
  const token = words[index];
  return token?.endsWith(',') ? token.slice(0, -1) : token;
}

/**
 * Matches `<key> <phrase> <value>` starting after `keyIndex` against
 * {@link FILTER_PHRASES} and returns the assembled ESQ filter plus the index
 * right after the value.
 */
function matchFilter(
  key: string,
  words: string[],
  keyIndex: number
): {esq: string; next: number} | null {
  for (const {phrase, esq} of FILTER_PHRASES) {
    const parts = phrase.split(' ');
    if (!parts.every((part, k) => words[keyIndex + 1 + k]?.toLowerCase() === part)) {
      continue;
    }
    const value = valueAt(words, keyIndex + 1 + parts.length);
    // A phrase with nothing after it ("browser is") is not a filter yet. Don't
    // retry shorter phrases: "count() is greater than" must not parse as
    // count():greater.
    if (value === undefined) {
      return null;
    }
    // If a longer phrase shares this one's prefix and the candidate value would
    // continue it, the user is mid-typing that longer phrase (e.g. "is greater
    // than" inside "is greater than or equal to"). Decline rather than consume
    // "or" as the value and emit count():>or from "...greater than or equal".
    const midLongerPhrase = FILTER_PHRASES.some(({phrase: longer}) => {
      const longerParts = longer.split(' ');
      return (
        longerParts.length > parts.length &&
        parts.every((part, k) => longerParts[k] === part) &&
        longerParts[parts.length]?.toLowerCase() === value.toLowerCase()
      );
    });
    if (midLongerPhrase) {
      return null;
    }
    return {esq: esq(key, value), next: keyIndex + parts.length + 2};
  }
  return null;
}

/**
 * Inverse of {@link formatQueryToNaturalLanguage}: turns humanized natural
 * language back into an ESQ query. Returns null when the input isn't cleanly
 * invertible, so callers can fall back to handing the raw text to Seer.
 */
export function parseNaturalLanguageToQuery(
  input: string,
  isFilterKey: (key: string) => boolean
): string | null {
  const words = tokenize(input.trim());
  const esq: string[] = [];

  let hasFilter = false;
  // `is` reads as the status key only at the start of a clause; trailing prose
  // ("the build is broken") is the English copula, so leave it alone.
  let atClauseStart = true;
  let i = 0;

  while (i < words.length) {
    const word = words[i];
    if (word === undefined) {
      break;
    }
    const lower = word.toLowerCase();

    if (lower === 'and' || lower === 'or') {
      esq.push(lower.toUpperCase());
      atClauseStart = true;
      i++;
      continue;
    }

    // "is [not] <status>" -> [!]is:<status>
    if (lower === 'is' && atClauseStart && isFilterKey('is')) {
      const negated = words[i + 1]?.toLowerCase() === 'not';
      const status = valueAt(words, negated ? i + 2 : i + 1);
      if (status !== undefined) {
        esq.push(`${negated ? '!' : ''}is:${status.toLowerCase()}`);
        hasFilter = true;
        i += negated ? 3 : 2;
        continue;
      }
    }

    // "<key> <operator phrase> <value>" -> ESQ filter (see FILTER_PHRASES)
    const filter = isFilterKey(word) ? matchFilter(word, words, i) : null;
    if (filter) {
      esq.push(filter.esq);
      hasFilter = true;
      atClauseStart = true;
      i = filter.next;
      continue;
    }

    // Anything else is free text. ESQ can end with free text while user is typing.
    if (esq.length === 0) {
      return null; // leads with free text -> hand the raw input to Seer
    }
    if (lower !== 'is' && isFilterKey(word)) {
      return null; // known key outside a filter shape -> not cleanly invertible
    }
    esq.push(word);
    atClauseStart = false;
    i++;
  }

  return hasFilter ? esq.join(' ') : null;
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

export function generateQueryTokensString(
  args: QueryTokensProps,
  projects: Project[] = []
): string {
  const parts = [];
  const {start, end, statsPeriod} = normalizeSeerDateTimeParams(args);

  // Mirror the visual QueryTokens: pull the project out of the filter text and
  // announce it as a separate projects clause so screen readers don't read a
  // `project:` filter that isn't shown in the Filter chips.
  const {query: displayQuery, projectIds} = resolveSeerProjectSelection(
    args?.query ?? '',
    projects,
    args?.expandedProjectIds
  );

  if (displayQuery) {
    const formattedFilter = formatQueryToNaturalLanguage(displayQuery.trim());
    parts.push(`Filter is '${formattedFilter}'`);
  }

  if (args?.visualizations && args.visualizations.length > 0) {
    const vizParts = args.visualizations.flatMap(visualization =>
      visualization.yAxes.map(yAxis =>
        isEquation(yAxis) ? stripEquationPrefix(yAxis) : yAxis
      )
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

  if (start && end) {
    parts.push(`time range is '${formatDateRange(start, end)}'`);
  } else if (statsPeriod) {
    parts.push(`time range is '${statsPeriod}'`);
  }

  if (args?.sort && args.sort.length > 0) {
    const descending = args?.sort[0] === '-';
    let rawSort = descending ? args?.sort.slice(1) : args?.sort;
    rawSort = isEquation(rawSort) ? stripEquationPrefix(rawSort) : rawSort;
    const formattedSort = descending ? `${rawSort} Desc` : `${rawSort} Asc`;

    parts.push(`sort is '${formattedSort}'`);
  }

  if (projectIds && projectIds.length > 0) {
    const idToSlug = new Map(projects.map(project => [project.id, project.slug]));
    const slugs = projectIds.map(id => idToSlug.get(String(id)) ?? String(id));
    parts.push(`projects are '${slugs.join(', ')}'`);
  }

  if (args?.crossEvents && args.crossEvents.length > 0) {
    const crossEventText = args.crossEvents
      .map(crossEvent =>
        crossEvent.type === 'metrics'
          ? `${crossEvent.type} ${crossEvent.metric.name}`
          : `${crossEvent.type} ${crossEvent.query}`
      )
      .join(', ');
    parts.push(`cross-event filters are '${crossEventText}'`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No query parameters set';
}

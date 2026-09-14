import {
  parseQueryBuilderValue,
  queryIsValid,
} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {parseFunction, type ParsedFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  AggregationKey,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {prettifyQueryConditions} from 'sentry/views/dashboards/utils/prettifyQueryConditions';
import {
  isVisualizeEquation,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';

const IF_SUFFIX = '_if';

/**
 * Shown when a visualize aggregate is used as a key in a series `_if` filter.
 */
export const CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE = t(
  'Aggregates cannot be used in conditional filters'
);

/**
 * Chart / table error when a series `_if` filter is invalid and querying is skipped.
 */
const CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE = t('Invalid series filter');

/**
 * Error message when an invalid series `_if` filter includes a visualize aggregate.
 */
export function getConditionalFilterInvalidSeriesMessage(filter: string): string {
  if (filterContainsVisualizeAggregateKey(filter)) {
    return CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE;
  }
  return CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE;
}

export function getConditionalFilterInvalidSeriesMessageForYAxis(yAxis: string): string {
  const filter = parseConditionalAggregate(yAxis)?.filter;
  if (!filter) {
    return CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE;
  }
  return getConditionalFilterInvalidSeriesMessage(filter);
}

export function getConditionalFilterInvalidSeriesMessageForVisualizes(
  visualizes: readonly Visualize[]
): string {
  for (const visualize of visualizes) {
    if (isVisualizeEquation(visualize)) {
      continue;
    }
    const filter = parseConditionalAggregate(visualize.yAxis)?.filter;
    if (filter && filterContainsVisualizeAggregateKey(filter)) {
      return CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE;
    }
  }
  return CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE;
}

/**
 * Span aggregates that the EAP `_if` combinator is generated for. Everything else
 * offered by the visualize dropdown (epm, eps, failure_rate, failure_count and the
 * score formulas) is a formula rather than an aggregate, and formulas do not get an
 * `_if` variant. See `SPAN_AGGREGATE_COMBINATORS` in
 * `src/sentry/search/eap/spans/aggregates.py`.
 */
const FILTERABLE_AGGREGATES: string[] = [
  AggregationKey.COUNT,
  AggregationKey.COUNT_UNIQUE,
  AggregationKey.SUM,
  AggregationKey.AVG,
  AggregationKey.MIN,
  AggregationKey.MAX,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P90,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.P100,
];

/**
 * Matches visualize aggregates used as search keys, with or without args
 * (`p95:`, `p95(span.duration):`, `count():`).
 */
const VISUALIZE_AGGREGATE_KEY_PATTERN = new RegExp(
  `(^|[\\s(!])(?:${ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.join('|')})(?:\\([^)]*\\))?:`
);

export type ConditionalAggregate = ParsedFunction;

/**
 * Remove backticks so the filter can be safely wrapped in them.
 *
 * The backtick delimiter has no escape sequence anywhere in the stack: the arithmetic
 * grammar matches `` "`" [^`]* "`" ``, the backend argument tokenizer ends the filter at
 * the first backtick it sees, and the resolver recovers the query by slicing off the
 * outer characters. A backtick in the middle of a filter therefore truncates the query
 * and can swallow the remaining aggregate arguments, so it is dropped instead. Backticks
 * carry no meaning in the search syntax, so nothing searchable is lost.
 */
export function escapeConditionalFilter(filter: string): string {
  return filter.replace(/`/g, '').trim();
}

/**
 * Split a visualize yAxis into its base aggregate and its `_if` filter.
 *
 * `avg_if(\`span.op:db\`,span.duration)` → `{name: 'avg', arguments: ['span.duration'], filter: 'span.op:db'}`
 * `avg(span.duration)` → `{name: 'avg', arguments: ['span.duration']}`
 */
export function parseConditionalAggregate(yAxis: string): ConditionalAggregate | null {
  const parsed = parseFunction(yAxis);
  if (!parsed) {
    return null;
  }
  if (parsed.filter === undefined) {
    return parsed;
  }

  const [, ...restArguments] = parsed.arguments;
  return {
    name: parsed.name.endsWith(IF_SUFFIX)
      ? parsed.name.slice(0, -IF_SUFFIX.length)
      : parsed.name,
    arguments: restArguments,
    filter: parsed.filter,
  };
}

/**
 * Build a visualize yAxis, adding the `_if` combinator when a filter is present.
 */
export function buildConditionalAggregate({
  name,
  arguments: args,
  filter,
}: {
  arguments: string[];
  filter: string;
  name: string;
}): string {
  const escapedFilter = escapeConditionalFilter(filter);
  if (!escapedFilter) {
    return `${name}(${args.join(',')})`;
  }
  return `${name}${IF_SUFFIX}(\`${escapedFilter}\`${args.map(arg => `,${arg}`).join('')})`;
}

/**
 * Set (or clear, when `filter` is empty) the `_if` filter on an existing yAxis.
 */
export function applyConditionalFilter(yAxis: string, filter: string): string {
  const conditional = parseConditionalAggregate(yAxis);
  if (!conditional) {
    return yAxis;
  }
  return buildConditionalAggregate({
    name: conditional.name,
    arguments: conditional.arguments,
    filter,
  });
}

/**
 * Rewrite the private-use wildcard markers the search builder emits (contains, starts
 * with, ends with) back into `*value*` syntax so `_if` filters are readable in chart
 * titles and table headers.
 */
export function withReadableConditionalFilter(yAxis: string): string {
  const conditional = parseConditionalAggregate(yAxis);
  if (!conditional?.filter) {
    return yAxis;
  }

  const readableFilter =
    prettifyQueryConditions(conditional.filter) ?? conditional.filter;
  if (readableFilter === conditional.filter) {
    return yAxis;
  }

  return buildConditionalAggregate({
    name: conditional.name,
    arguments: conditional.arguments,
    filter: readableFilter,
  });
}

/**
 * Whether an aggregate can carry an `_if` search filter.
 */
export function supportsConditionalAggregateFilter(aggregateName: string): boolean {
  return FILTERABLE_AGGREGATES.includes(aggregateName);
}

/**
 * Whether a yAxis already carries an `_if` search filter.
 */
export function hasConditionalAggregateFilter(yAxis: string): boolean {
  return Boolean(parseConditionalAggregate(yAxis)?.filter);
}

/**
 * True when the filter uses a visualize aggregate as a search key
 * (`p95(span.duration):>300ms`, `count():>0`, …).
 *
 * The search parser often falls back to free text for these when duration/numeric
 * config is missing (e.g. empty `filterKeys`), so `queryIsValid` alone is not enough.
 */
function filterContainsVisualizeAggregateKey(filter: string): boolean {
  return VISUALIZE_AGGREGATE_KEY_PATTERN.test(filter);
}

/**
 * Whether a series `_if` filter is safe to send to the backend.
 *
 * Mirrors the series-filter search bar: aggregates are not valid filter keys, and
 * parser errors (e.g. missing values) are also rejected. Empty filters are valid
 * (no combinator).
 */
export function isConditionalAggregateFilterValid(filter: string): boolean {
  if (!filter.trim()) {
    return true;
  }

  // Aggregates are never valid series-filter keys. Check the string first so cases
  // the parser treats as free text (e.g. `p95(span.duration):>300ms` without
  // duration config) still block the backend request.
  if (filterContainsVisualizeAggregateKey(filter)) {
    return false;
  }

  const parsed = parseQueryBuilderValue(filter, key => getFieldDefinition(key, 'span'), {
    filterKeys: {},
    // Same list the toolbar / column editor pass as `invalidFilterKeys`.
    invalidFilterKeys: ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  });
  return queryIsValid(parsed);
}

/**
 * Whether a visualize yAxis's `_if` filter (if any) is valid for querying.
 */
export function isConditionalAggregateYAxisValid(yAxis: string): boolean {
  const conditional = parseConditionalAggregate(yAxis);
  if (!conditional?.filter) {
    return true;
  }
  return isConditionalAggregateFilterValid(conditional.filter);
}

/**
 * True when every series is a non-equation visualize with an invalid `_if` filter.
 *
 * Used to skip chart/table requests and show the series-filter error without treating
 * invalid equations the same way (those keep prior empty/fallback query behavior).
 */
export function areAllVisualizesInvalidConditionalFilters(
  visualizes: readonly Visualize[]
): boolean {
  if (!visualizes.length) {
    return false;
  }
  return visualizes.every(
    visualize =>
      !isVisualizeEquation(visualize) &&
      !isConditionalAggregateYAxisValid(visualize.yAxis)
  );
}

import {
  ensureSearchFilterArgument,
  escapeConditionalFilter,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {
  parseQueryBuilderValue,
  queryIsValid,
} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {
  parseFunction,
  stripEquationPrefix,
  type ParsedFunction,
} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  AggregationKey,
  EXPLORE_FILTERABLE_AGGREGATES,
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
 * Matches visualize aggregates used as search keys, with or without args
 * (`p95:`, `p95(span.duration):`, `count():`).
 */
const VISUALIZE_AGGREGATE_KEY_PATTERN = new RegExp(
  `(^|[\\s(!])(?:${ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.join('|')})(?:\\([^)]*\\))?:`
);

export type ConditionalAggregate = ParsedFunction;

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

  return {
    name: parsed.name.endsWith(IF_SUFFIX)
      ? parsed.name.slice(0, -IF_SUFFIX.length)
      : parsed.name,
    // Drop the backtick-wrapped filter; remaining args are the aggregate columns.
    arguments: parsed.arguments.slice(1),
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
  if (!escapeConditionalFilter(filter)) {
    return `${name}(${args.join(',')})`;
  }
  return `${name}${IF_SUFFIX}(${ensureSearchFilterArgument(filter)}${args
    .map(arg => `,${arg}`)
    .join('')})`;
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
  return EXPLORE_FILTERABLE_AGGREGATES.includes(aggregateName as AggregationKey);
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
 *
 * Plain aggregates (no `_if`) are always valid here. An `_if` with an empty
 * filter (`avg_if(\`\`,span.duration)`) is invalid: the backend combinator rejects
 * empty queries and falls back to the deprecated Discover-style condition args.
 */
export function isConditionalAggregateYAxisValid(yAxis: string): boolean {
  const conditional = parseConditionalAggregate(yAxis);
  if (!conditional) {
    return true;
  }
  // `filter === undefined` → no `_if` combinator. `filter === ''` → empty backticks.
  if (conditional.filter === undefined) {
    return true;
  }
  if (!conditional.filter.trim()) {
    return false;
  }
  return isConditionalAggregateFilterValid(conditional.filter);
}

/**
 * Validate every `_if(...)` call inside an equation (or any free-form expression).
 *
 * Equation yAxes are not themselves a single aggregate, so
 * {@link isConditionalAggregateYAxisValid} alone is not enough.
 */
export function areConditionalAggregateFiltersInExpressionValid(
  expression: string
): boolean {
  const tokens = tokenizeExpression(stripEquationPrefix(expression));
  for (const token of tokens) {
    if (isTokenFunction(token) && token.function.endsWith(IF_SUFFIX)) {
      if (!isConditionalAggregateYAxisValid(token.text)) {
        return false;
      }
    }
  }
  return true;
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

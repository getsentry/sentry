import {
  parseFunction,
  type ParsedConditionalFunction,
} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import {prettifyQueryConditions} from 'sentry/views/dashboards/utils/prettifyQueryConditions';

const IF_SUFFIX = '_if';

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

export type ConditionalAggregate = ParsedConditionalFunction;

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
 * `avg(span.duration)` → `{name: 'avg', arguments: ['span.duration'], filter: ''}`
 */
export function parseConditionalAggregate(yAxis: string): ConditionalAggregate | null {
  return parseFunction(yAxis, {normalizeIfCombinator: true});
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

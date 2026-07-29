import {
  isTokenFunction,
  type TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {parseFunction, type ParsedFunction} from 'sentry/utils/discover/fields';
import {AggregationKey, NO_ARGUMENT_SPAN_AGGREGATES} from 'sentry/utils/fields';
import {prettifyQueryConditions} from 'sentry/views/dashboards/utils/prettifyQueryConditions';

export const IF_SUFFIX = '_if';

export interface ConditionalAggregate extends ParsedFunction {
  /**
   * Search filter for the `_if` combinator. Empty when the aggregate is unconditional.
   */
  filter: string;
}

function isBacktickSearchFilter(value: string): boolean {
  return value.length >= 2 && value.startsWith('`') && value.endsWith('`');
}

/**
 * Strip a leading `_if` combinator and extract its filter query from a function token.
 *
 * Only Explore-style search filters (backtick-wrapped first argument) are treated as
 * conditional. Discover-style forms like `count_if(column,equals,value)` are left as-is.
 */
export function normalizeConditionalFunctionToken(token: TokenFunction): {
  filter: string;
  plainAggregate: string;
} {
  if (!token.function.endsWith(IF_SUFFIX) || token.attributes.length === 0) {
    return {plainAggregate: token.text, filter: ''};
  }

  const [filterAttr, ...restAttrs] = token.attributes;
  const filterText = filterAttr?.text ?? '';
  if (!isBacktickSearchFilter(filterText)) {
    return {plainAggregate: token.text, filter: ''};
  }

  const plainName = token.function.slice(0, -IF_SUFFIX.length);
  return {
    plainAggregate: `${plainName}(${restAttrs.map(a => a.text).join(',')})`,
    filter: filterText.slice(1, -1),
  };
}

/**
 * Parse a visualize yAxis into its base aggregate and optional `_if` filter.
 *
 * `avg_if(\`span.op:db\`,span.duration)` → `{name: 'avg', arguments: ['span.duration'], filter: 'span.op:db'}`
 * `avg(span.duration)` → `{name: 'avg', arguments: ['span.duration'], filter: ''}`
 */
export function parseConditionalAggregate(yAxis: string): ConditionalAggregate | null {
  const tokens = tokenizeExpression(yAxis);
  const token = tokens.find(isTokenFunction);

  if (token) {
    const {plainAggregate, filter} = normalizeConditionalFunctionToken(token);
    const parsed = parseFunction(plainAggregate);
    if (parsed) {
      return {...parsed, filter};
    }
  }

  const parsed = parseFunction(yAxis);
  if (!parsed) {
    return null;
  }

  if (!parsed.name.endsWith(IF_SUFFIX)) {
    return {...parsed, filter: ''};
  }

  // Fallback when tokenization fails but the name still looks like an `_if` aggregate.
  const [filterArg, ...restArgs] = parsed.arguments;
  const filterText = filterArg ?? '';
  if (!isBacktickSearchFilter(filterText)) {
    // Discover-style `count_if(column,equals,value)` — keep the original aggregate.
    return {...parsed, filter: ''};
  }

  return {
    name: parsed.name.slice(0, -IF_SUFFIX.length),
    arguments: restArgs,
    filter: filterText.slice(1, -1),
  };
}

/**
 * Build a visualize yAxis, wrapping with `_if` when a filter is present.
 *
 * Empty/whitespace-only filters are treated as unconditional.
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
  const trimmedFilter = filter.trim();
  if (!trimmedFilter) {
    return `${name}(${args.join(',')})`;
  }
  if (args.length === 0) {
    return `${name}${IF_SUFFIX}(\`${trimmedFilter}\`)`;
  }
  return `${name}${IF_SUFFIX}(\`${trimmedFilter}\`,${args.join(',')})`;
}

/**
 * Apply a filter to an existing plain aggregate yAxis string.
 */
export function applyConditionalFilter(yAxis: string, filter: string): string {
  const parsed = parseFunction(yAxis);
  if (!parsed) {
    return yAxis;
  }
  return buildConditionalAggregate({
    name: parsed.name.endsWith(IF_SUFFIX)
      ? parsed.name.slice(0, -IF_SUFFIX.length)
      : parsed.name,
    arguments: parsed.name.endsWith(IF_SUFFIX)
      ? parsed.arguments.slice(1)
      : parsed.arguments,
    filter,
  });
}

/**
 * Rewrite `_if` filter unicode wildcard markers (contains / starts with / ends with)
 * into readable `*value*` syntax for display.
 */
export function withReadableConditionalFilter(yAxis: string): string {
  const conditional = parseConditionalAggregate(yAxis);
  if (!conditional) {
    return yAxis;
  }

  const trimmedFilter = conditional.filter.trim();
  if (!trimmedFilter) {
    return yAxis;
  }

  const readableFilter = prettifyQueryConditions(trimmedFilter) ?? trimmedFilter;
  if (readableFilter === trimmedFilter) {
    return yAxis;
  }

  return buildConditionalAggregate({
    name: conditional.name,
    arguments: conditional.arguments,
    filter: readableFilter,
  });
}

/**
 * Whether a visualize aggregate can use the `_if` span-search filter bar.
 *
 * Uses {@link NO_ARGUMENT_SPAN_AGGREGATES} (epm, eps, failure_rate, failure_count, …)
 * plus score formulas that take a fixed measurement column.
 */
export function supportsConditionalAggregateFilter(aggregateName: string): boolean {
  if (NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregateName as AggregationKey)) {
    return false;
  }
  return (
    aggregateName !== AggregationKey.PERFORMANCE_SCORE &&
    aggregateName !== AggregationKey.OPPORTUNITY_SCORE &&
    aggregateName !== AggregationKey.APDEX &&
    aggregateName !== AggregationKey.USER_MISERY
  );
}

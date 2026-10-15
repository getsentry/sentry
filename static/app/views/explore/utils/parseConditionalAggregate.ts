import {parseFunction, type ParsedFunction} from 'sentry/utils/discover/fields';

export const IF_SUFFIX = '_if';

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

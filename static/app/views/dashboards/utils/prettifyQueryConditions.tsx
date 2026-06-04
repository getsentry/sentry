import {NAMESPACE_SYMBOL} from 'sentry/actionCreators/savedSearches';

const OPERATOR_WITH_VALUE_PATTERN = new RegExp(
  `${NAMESPACE_SYMBOL}(\\w+)${NAMESPACE_SYMBOL}([^\\s]*)`,
  'g'
);

/**
 * Converts internal wildcard operator markers in a conditions string back to
 * their user-facing wildcard syntax. The search syntax uses
 * {@link NAMESPACE_SYMBOL} around operator names like "Contains" and
 * "StartsWith".
 *
 * - `Contains` / `DoesNotContain` → `*value*`
 * - `StartsWith` / `DoesNotStartWith` → `value*`
 * - `EndsWith` / `DoesNotEndWith` → `*value`
 *
 * Negation is expressed via `!` on the key (e.g., `!transaction:*value*`),
 * not in the operator marker, so the `DoesNot*` variants produce the same
 * wildcards as their positive counterparts.
 */
export function prettifyQueryConditions(
  conditions: string | undefined
): string | undefined {
  if (!conditions) {
    return undefined;
  }
  return conditions.replace(
    OPERATOR_WITH_VALUE_PATTERN,
    (_match, operator: string, value: string) => {
      switch (operator) {
        case 'Contains':
        case 'DoesNotContain':
          return `*${value}*`;
        case 'StartsWith':
        case 'DoesNotStartWith':
          return `${value}*`;
        case 'EndsWith':
        case 'DoesNotEndWith':
          return `*${value}`;
        default:
          return value;
      }
    }
  );
}

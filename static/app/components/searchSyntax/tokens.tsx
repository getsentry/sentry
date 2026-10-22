// The token enums live in @sentry/search-syntax, next to the grammar, so the
// published parser and the app share one definition.
export {
  BooleanOperator,
  FilterType,
  regexOperators,
  TermOperator,
  Token,
  wildcardOperators,
  type RegexOperator,
  type WildcardOperator,
} from '@sentry/search-syntax/tokens';

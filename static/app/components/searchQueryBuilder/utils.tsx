import type {QueryBuilderFocusState} from 'sentry/components/searchQueryBuilder/types';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';

export function focusIsWithinToken(
  focus: QueryBuilderFocusState | null,
  token: TokenResult<Token>
) {
  if (!focus) {
    return false;
  }

  return (
    focus.range.start >= token.location.start.offset &&
    focus.range.end <= token.location.end.offset
  );
}

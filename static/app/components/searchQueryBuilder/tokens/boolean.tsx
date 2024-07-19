import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {DeletableToken} from 'sentry/components/searchQueryBuilder/tokens/deletableToken';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';

type SearchQueryBuilderBooleanProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.LOGIC_BOOLEAN>;
};

export function SearchQueryBuilderBoolean({
  item,
  state,
  token,
}: SearchQueryBuilderBooleanProps) {
  return (
    <DeletableToken
      item={item}
      state={state}
      token={token}
      label={token.value}
      invalid={token.invalid}
    >
      {token.text}
    </DeletableToken>
  );
}

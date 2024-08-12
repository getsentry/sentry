import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {DeletableToken} from 'sentry/components/searchQueryBuilder/tokens/deletableToken';
import {
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconParenthesis} from 'sentry/icons/iconParenthesis';

type SearchQueryBuilderParenProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.L_PAREN | Token.R_PAREN>;
};

export function SearchQueryBuilderParenIcon({
  token,
}: Pick<SearchQueryBuilderParenProps, 'token'>) {
  return (
    <IconParenthesis side={token.type === Token.L_PAREN ? 'left' : 'right'} height={26} />
  );
}

export function SearchQueryBuilderParen({
  item,
  state,
  token,
}: SearchQueryBuilderParenProps) {
  return (
    <DeletableToken
      item={item}
      state={state}
      token={token}
      label={token.value}
      invalid={token.invalid}
    >
      <SearchQueryBuilderParenIcon token={token} />
    </DeletableToken>
  );
}

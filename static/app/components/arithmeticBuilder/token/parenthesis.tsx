import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {Token, TokenParenthesis} from 'sentry/components/arithmeticBuilder/token';
import {Parenthesis} from 'sentry/components/arithmeticBuilder/token';
import {DeletableToken} from 'sentry/components/arithmeticBuilder/token/deletableToken';
import {IconParenthesis} from 'sentry/icons/iconParenthesis';

interface ArithmeticTokenParenthesisProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenParenthesis;
}

export function ArithmeticTokenParenthesis({
  item,
  state,
  token,
}: ArithmeticTokenParenthesisProps) {
  const side =
    token.parenthesis === Parenthesis.OPEN
      ? ('left' as const)
      : token.parenthesis === Parenthesis.CLOSE
        ? ('right' as const)
        : null;

  if (!side) {
    throw new Error(`Unexpected parenthesis: ${token.parenthesis}`);
  }

  return (
    <DeletableToken label={side} item={item} state={state} token={token}>
      <IconParenthesis side={side} height={26} />
    </DeletableToken>
  );
}

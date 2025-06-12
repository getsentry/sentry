import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {Token, TokenOperator} from 'sentry/components/arithmeticBuilder/token';
import {Operator} from 'sentry/components/arithmeticBuilder/token';
import {DeletableToken} from 'sentry/components/arithmeticBuilder/token/deletableToken';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDivide} from 'sentry/icons/iconDivide';
import {IconSubtract} from 'sentry/icons/iconSubtract';

interface ArithmeticTokenOperatorProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenOperator;
}

export function ArithmeticTokenOperator({
  item,
  state,
  token,
}: ArithmeticTokenOperatorProps) {
  const operator =
    token.operator === Operator.PLUS ? (
      <IconAdd height={26} />
    ) : token.operator === Operator.MINUS ? (
      <IconSubtract height={26} />
    ) : token.operator === Operator.MULTIPLY ? (
      <IconClose height={26} data-test-id="icon-multiply" />
    ) : token.operator === Operator.DIVIDE ? (
      <IconDivide height={26} />
    ) : null;

  if (!operator) {
    throw new Error(`Unexpected operator: ${token.operator}`);
  }

  return (
    <DeletableToken label={token.operator} item={item} state={state} token={token}>
      {operator}
    </DeletableToken>
  );
}

import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {Token, TokenReference} from 'sentry/components/arithmeticBuilder/token';
import {DeletableToken} from 'sentry/components/arithmeticBuilder/token/deletableToken';

interface ArithmeticBuilderTokenReferenceProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenReference;
}

export function ArithmeticBuilderTokenReference({
  item,
  state,
  token,
}: ArithmeticBuilderTokenReferenceProps) {
  return (
    <DeletableToken label={token.label} item={item} state={state} token={token}>
      {token.label}
    </DeletableToken>
  );
}

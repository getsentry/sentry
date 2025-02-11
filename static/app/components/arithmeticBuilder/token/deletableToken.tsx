import type {KeyboardEvent, MouseEvent} from 'react';
import {useCallback} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {DeletableToken as GenericDeletableToken} from 'sentry/components/tokenizedInput/token/deletableToken';

interface DeletableTokenProps {
  children: React.ReactNode;
  item: Node<Token>;
  label: string;
  state: ListState<Token>;
  token: Token;
}

export function DeletableToken({
  children,
  label,
  item,
  state,
  token,
}: DeletableTokenProps) {
  const {dispatch} = useArithmeticBuilder();

  const onDelete = useCallback(
    (evt: KeyboardEvent<HTMLDivElement> | MouseEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      dispatch({type: 'DELETE_TOKEN', token});
    },
    [dispatch, token]
  );

  return (
    <GenericDeletableToken item={item} label={label} state={state} onDelete={onDelete}>
      {children}
    </GenericDeletableToken>
  );
}

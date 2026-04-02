import {useCallback} from 'react';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {DeleteButton} from 'sentry/components/arithmeticBuilder/token/styles';
import {IconClose} from 'sentry/icons';
import {defined} from 'sentry/utils';

interface DeleteButtonProps {
  token: Token;
  focusOverrideKey?: string | null;
  label?: string;
}

export function DeleteBlah({token, focusOverrideKey, label}: DeleteButtonProps) {
  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    dispatch({
      type: 'DELETE_TOKEN',
      token,
      focusOverride: defined(focusOverrideKey) ? {itemKey: focusOverrideKey} : undefined,
    });
  }, [dispatch, token, focusOverrideKey]);

  return (
    <DeleteButton aria-label={label} onClick={onClick}>
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

import {useCallback} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {IconClose} from 'sentry/icons';
import {defined} from 'sentry/utils';

interface DeleteButtonProps {
  token: Token;
  focusOverrideKey?: string | null;
  label?: string;
}

export function DeleteButton({token, focusOverrideKey, label}: DeleteButtonProps) {
  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    dispatch({
      type: 'DELETE_TOKEN',
      token,
      focusOverride: defined(focusOverrideKey) ? {itemKey: focusOverrideKey} : undefined,
    });
  }, [dispatch, token, focusOverrideKey]);

  return (
    <StyledDeleteButton aria-label={label} onClick={onClick}>
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </StyledDeleteButton>
  );
}

const StyledDeleteButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.tokens.content.secondary};
  outline: none;
  user-select: none;
  padding-right: ${p => p.theme.space.xs};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    outline: none;
  }
`;

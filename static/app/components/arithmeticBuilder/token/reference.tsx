import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenReference} from 'sentry/components/arithmeticBuilder/token';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

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
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: false,
  });

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.label}
      aria-invalid={false}
    >
      <LabelGridCell {...gridCellProps}>{token.label}</LabelGridCell>
      <GridCell {...gridCellProps}>
        <DeleteReference token={token} item={item} state={state} />
      </GridCell>
    </Row>
  );
}

interface DeleteReferenceProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenReference;
}

function DeleteReference({token, item, state}: DeleteReferenceProps) {
  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    const itemKey = state.collection.getKeyBefore(item.key);
    dispatch({
      type: 'DELETE_TOKEN',
      token,
      focusOverride: defined(itemKey) ? {itemKey} : undefined,
    });
  }, [dispatch, token, state, item]);

  return (
    <DeleteButton aria-label={t('Remove reference %s', token.label)} onClick={onClick}>
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

const Row = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    outline: none;
  }

  &:last-child {
    flex-grow: 1;
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.colors.gray100};
  }
`;

const GridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
`;

// color: ${p => p.theme.colors.purple500};
// font-weight: ${p => p.theme.font.weight.bold};
const LabelGridCell = styled(GridCell)`
  padding-left: ${p => p.theme.space.xs};
  padding-right: ${p => p.theme.space.xs};
  user-select: none;
  white-space: nowrap;
`;

const DeleteButton = styled('button')`
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

import type {MouseEvent} from 'react';
import {useCallback, useRef} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {Token, TokenOperator} from 'sentry/components/arithmeticBuilder/token';
import {Operator} from 'sentry/components/arithmeticBuilder/token';
import {DeleteButton} from 'sentry/components/arithmeticBuilder/token/deleteButton';
import {
  GridCell,
  LeftGridCell,
  Row,
} from 'sentry/components/arithmeticBuilder/token/styles';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {shiftFocusToChild} from 'sentry/components/tokenizedInput/token/utils';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDivide} from 'sentry/icons/iconDivide';
import {IconSubtract} from 'sentry/icons/iconSubtract';
import {t} from 'sentry/locale';

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
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: true,
  });

  const handleOnClick = useCallback(
    (evt: MouseEvent<HTMLDivElement>) => {
      evt.stopPropagation();
      shiftFocusToChild(evt.currentTarget, item, state);
    },
    [item, state]
  );

  const operator =
    token.operator === Operator.PLUS ? (
      <IconAdd size="xs" />
    ) : token.operator === Operator.MINUS ? (
      <IconSubtract size="xs" />
    ) : token.operator === Operator.MULTIPLY ? (
      <IconClose size="xs" data-test-id="icon-multiply" />
    ) : token.operator === Operator.DIVIDE ? (
      <IconDivide size="xs" />
    ) : null;

  if (!operator) {
    throw new Error(`Unexpected operator: ${token.operator}`);
  }

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.operator}
      aria-invalid={false}
      withBorder
      onClick={handleOnClick}
    >
      <LeftGridCell {...gridCellProps}>{operator}</LeftGridCell>
      <GridCell {...gridCellProps}>
        <DeleteButton
          token={token}
          focusOverrideKey={state.collection.getKeyBefore(item.key)?.toString() ?? null}
          label={t('Remove operator %s', token.operator)}
          tabIndex={-1}
        />
      </GridCell>
    </Row>
  );
}

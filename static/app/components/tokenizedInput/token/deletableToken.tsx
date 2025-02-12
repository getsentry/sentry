import type {KeyboardEvent, MouseEvent} from 'react';
import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusNext, focusPrev} from 'sentry/components/tokenizedInput/grid/utils';
import {shiftFocusToChild} from 'sentry/components/tokenizedInput/token/utils';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';

interface DeletableTokenProps<T> {
  children: React.ReactNode;
  item: Node<T>;
  label: string;
  onDelete: (evt: KeyboardEvent<HTMLDivElement> | MouseEvent<HTMLButtonElement>) => void;
  state: ListState<T>;
}

export function DeletableToken<T>({
  children,
  label,
  item,
  onDelete,
  state,
}: DeletableTokenProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
  });

  const onKeyDownCapture = useCallback(
    (evt: KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'ArrowLeft') {
        focusPrev(state, item);
        return;
      }

      if (evt.key === 'ArrowRight') {
        focusNext(state, item);
        return;
      }
    },
    [state, item]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLDivElement>) => {
      if (evt.key === 'Backspace' || evt.key === 'Delete') {
        onDelete(evt);
      }
    },
    [onDelete]
  );

  const onClick = useCallback(
    (evt: MouseEvent<HTMLDivElement>) => {
      evt.stopPropagation();
      shiftFocusToChild(evt.currentTarget, item, state);
    },
    [item, state]
  );

  return (
    <Wrapper
      {...rowProps}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onKeyDownCapture={onKeyDownCapture}
      aria-invalid={false} // TODO: handle invalid state
      ref={ref}
    >
      {children}
      <HoverFocusBorder>
        <FloatingCloseButton
          {...gridCellProps}
          tabIndex={-1}
          aria-label={t('Delete %s', label)}
          onClick={onDelete}
        >
          <InteractionStateLayer />
          <IconClose legacySize="10px" />
        </FloatingCloseButton>
      </HoverFocusBorder>
    </Wrapper>
  );
}

const FloatingCloseButton = styled('button')`
  background: ${p => p.theme.background};
  outline: none;
  user-select: none;
  padding: 0;
  border: none;
  color: ${p => p.theme.subText};
  border-radius: 2px 2px 0 0;
  box-shadow: 0 0 0 1px ${p => p.theme.innerBorder};
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: -14px;
  height: 14px;
  width: 100%;

  &:focus,
  &:hover {
    outline: none;
    border: none;
    background: ${p => p.theme.button.default.backgroundActive};
  }

  &:focus-visible {
    box-shadow: 0 0 0 1px ${p => p.theme.innerBorder};
  }
`;

const Wrapper = styled('div')`
  position: relative;
  height: 24px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;

  &:focus {
    outline: none;
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.gray100};
  }

  &[aria-invalid='true'] {
    color: ${p => p.theme.red400};
  }

  /* Need to hide visually but keep focusable */
  &:not(:hover):not(:focus-within) {
    color: ${p => p.theme.subText};

    &[aria-invalid='true'] {
      color: ${p => p.theme.red400};
    }

    ${FloatingCloseButton} {
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const HoverFocusBorder = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  height: 33px;
  transform: translate(-50%, -50%);
  border-radius: 0 0 2px 2px;
  min-width: 14px;
  width: calc(100% + 4px);

  &:focus-within,
  &:hover {
    box-shadow: 0 0 0 1px ${p => p.theme.innerBorder};
  }
`;

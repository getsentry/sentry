import type React from 'react';
import {useRef} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGridItem';
import {InvalidTokenTooltip} from 'sentry/components/searchQueryBuilder/tokens/invalidTokenTooltip';
import {
  shiftFocusToChild,
  useShiftFocusToChild,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  InvalidReason,
  ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type DeletableTokenProps = {
  children: React.ReactNode;
  item: Node<ParseResultToken>;
  label: string;
  state: ListState<ParseResultToken>;
  token: ParseResultToken;
  invalid?: {type: InvalidReason; reason?: string} | null;
};

export function DeletableToken({
  item,
  state,
  token,
  label,
  children,
  invalid,
}: DeletableTokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch} = useSearchQueryBuilder();
  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);
  const {shiftFocusProps} = useShiftFocusToChild(item, state);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      e.stopPropagation();
      dispatch({type: 'DELETE_TOKEN', token});
    }
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    shiftFocusToChild(e.currentTarget, item, state);
  };

  const isInvalid = Boolean(invalid);

  return (
    <Wrapper
      {...mergeProps(rowProps, shiftFocusProps, {onKeyDown, onClick})}
      aria-invalid={isInvalid}
      ref={ref}
    >
      {children}
      <InvalidTokenTooltip token={token} state={state} item={item}>
        <HoverFocusBorder>
          <FloatingCloseButton
            {...gridCellProps}
            tabIndex={-1}
            aria-label={t('Delete %s', label)}
            onClick={e => {
              e.stopPropagation();
              dispatch({type: 'DELETE_TOKEN', token});
            }}
          >
            <InteractionStateLayer />
            <IconClose legacySize="10px" />
          </FloatingCloseButton>
        </HoverFocusBorder>
      </InvalidTokenTooltip>
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

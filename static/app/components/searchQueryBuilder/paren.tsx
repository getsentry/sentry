import {useRef} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import {
  shiftFocusToChild,
  useShiftFocusToChild,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconClose} from 'sentry/icons';
import {IconParenthesis} from 'sentry/icons/iconParenthesis';
import {t} from 'sentry/locale';

type SearchQueryBuilderParenProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.L_PAREN | Token.R_PAREN>;
};

export function SearchQueryBuilderParen({
  item,
  state,
  token,
}: SearchQueryBuilderParenProps) {
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

  return (
    <Wrapper {...mergeProps(rowProps, shiftFocusProps, {onKeyDown, onClick})} ref={ref}>
      <IconParenthesis
        side={token.type === Token.L_PAREN ? 'left' : 'right'}
        height={26}
      />
      <HoverFocusBorder>
        <FloatingCloseButton
          {...gridCellProps}
          tabIndex={-1}
          aria-label={t('Delete %s', token.value)}
          onClick={e => {
            e.stopPropagation();
            dispatch({type: 'DELETE_TOKEN', token});
          }}
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
  width: 14px;

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
  width: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:focus {
    outline: none;
  }

  /* Need to hide visually but keep focusable */
  &:not(:hover):not(:focus-within) {
    color: ${p => p.theme.subText};

    ${FloatingCloseButton} {
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
  }
`;

const HoverFocusBorder = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 33px;
  transform: translate(-50%, -50%);
  border-radius: 0 0 2px 2px;

  &:focus-within,
  &:hover {
    box-shadow: 0 0 0 1px ${p => p.theme.innerBorder};
  }
`;

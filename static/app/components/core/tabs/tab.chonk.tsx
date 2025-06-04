import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {css} from '@emotion/react';
import type {Orientation} from '@react-types/shared';

import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

import {tabsShouldForwardProp} from './utils';

export const ChonkStyledTabWrap = chonkStyled('li', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  overflowing: boolean;
  selected: boolean;
}>`
  color: ${p => (p.selected ? p.theme.tokens.component.link.accent.default : p.theme.tokens.component.link.muted.default)};
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: none;
  }

  &[aria-disabled] {
    opacity: ${p => (p.overflowing ? 0 : 0.6)};
    cursor: default;
  }

  ${p =>
    p.overflowing &&
    css`
      opacity: 0;
      pointer-events: none;
    `}
`;

export const ChonkStyledFocusLayer = chonkStyled('div')<{orientation: Orientation}>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};

  pointer-events: none;
  border-radius: inherit;
  z-index: 0;

  li[aria-disabled]:hover & {
    background-color: transparent;
  }

  li:focus-visible & {
    ${p => p.theme.focusRing}
  }

  li:hover & {
    background-color: ${p => p.theme.gray100};
    color: ${p => p.theme.tokens.component.link.muted.hover};
  }

  li:active & {
    background-color: ${p => p.theme.gray200};
  }

`;

export const chonkInnerWrapStyles = ({
  theme,
  orientation,
}: {
  orientation: Orientation;
  theme: DO_NOT_USE_ChonkTheme;
}) => css`
  display: flex;
  align-items: center;
  position: relative;
  height: calc(
    ${theme.form.sm.height} + ${orientation === 'horizontal' ? space(0.75) : '0px'}
  );
  border-radius: ${theme.borderRadius};
  transform: translateY(1px);

  ${orientation === 'horizontal'
    ? css`
        /**
         * Extra padding + negative margin trick, to expand click area
         * The difference between 10px and 14 is to account for
         *  2px width of the SelectionIndicator and 2px spacing towards it
         */
        padding: 10px 16px 14px 16px;
        margin-left: -${space(1)};
        margin-right: -${space(1)};
      `
    : css`
        padding: 10px 16px;
        /**
          * To align the SelectionIndicator (2px width, 4px spacing)
          */
        margin-left: 6px;
      `};
`;
export const ChonkStyledTabSelectionIndicator = chonkStyled('div')<{
  orientation: Orientation;
  selected: boolean;
}>`
  position: absolute;
  border-radius: 1px;
  pointer-events: none;
  background: ${p => (p.selected ? p.theme.colors.blue400 : 'transparent')};

  li[aria-disabled] & {
    opacity: 0.6;
  }

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          width: 100%;
          height: 2px;

          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        `
      : css`
          width: 2px;
          height: 50%;

          left: -6px;
          top: 50%;
          transform: translateY(-50%);
        `};
`;

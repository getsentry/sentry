import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {DOMAttributes, Orientation} from '@react-types/shared';

import type {Theme} from 'sentry/utils/theme';

import {tabsShouldForwardProp} from './utils';

export interface BaseTabProps {
  children: React.ReactNode;
  disabled: boolean;
  hidden: boolean;
  isSelected: boolean;
  orientation: Orientation;
  overflowing: boolean;
  size: 'md' | 'sm' | 'xs';
  tabProps: DOMAttributes;
  as?: React.ElementType;
  ref?: React.Ref<HTMLLIElement>;
  to?: string;
  variant?: 'flat' | 'floating';
}

export const ChonkStyledTabWrap = styled('li', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  overflowing: boolean;
  selected: boolean;
}>`
  color: ${p =>
    p.selected
      ? p.theme.tokens.component.link.accent.default
      : p.theme.tokens.component.link.muted.default};
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

const paddingPerSize = (theme: Theme, orientation: Orientation) => ({
  md: orientation === 'horizontal' ? `10px ${theme.space.xl}` : `10px ${theme.space.md}`,
  sm:
    orientation === 'horizontal'
      ? `${theme.space.md} ${theme.space.lg}`
      : `${theme.space.md} ${theme.space.sm}`,
  xs:
    orientation === 'horizontal'
      ? `${theme.space.sm} ${theme.space.md}`
      : `${theme.space.sm} ${theme.space.xs}`,
});

const selectionIndicatorSize = '2px';

export const chonkInnerWrapStyles = ({
  theme,
  orientation,
  variant,
  size,
  selected,
}: {
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  theme: Theme;
  variant: BaseTabProps['variant'];
}) => css`
  display: flex;
  align-items: center;
  position: relative;
  height: ${theme.form[size].height};
  min-height: ${theme.form[size].minHeight};
  font-size: ${theme.form[size].fontSize};
  line-height: ${theme.form[size].lineHeight};
  padding: ${paddingPerSize(theme, orientation)[size]};
  border-radius: ${theme.radius.md};
  transform: translateY(1px);
  margin-bottom: ${orientation === 'horizontal' && variant === 'flat'
    ? theme.space.xs
    : 0};

  ${orientation === 'horizontal'
    ? css`
        gap: ${theme.space.md};
      `
    : css`
        gap: ${theme.space.sm};
        /**
          * To align the SelectionIndicator (2px width, 4px spacing)
          */
        margin-left: ${variant === 'flat'
          ? `calc(${theme.space.xs} + ${selectionIndicatorSize})`
          : 0};
        /* static padding towards SelectionIndicator */
        padding-left: ${theme.space.md};
      `};

  li[aria-disabled]:hover & {
    background-color: transparent;
  }

  li:focus-visible & {
    outline: none;
    box-shadow: inset 0 0 0 2px ${theme.focusBorder};
  }

  li:not([aria-disabled]):hover & {
    background-color: ${selected
      ? variant === 'floating'
        ? theme.colors.blue200
        : theme.colors.blue100
      : theme.colors.gray100};
    color: ${selected
      ? theme.tokens.component.link.accent.hover
      : theme.tokens.component.link.muted.hover};
  }

  li:not([aria-disabled]):active & {
    background-color: ${selected
      ? variant === 'floating'
        ? theme.colors.blue300
        : theme.colors.blue200
      : theme.colors.gray200};
    color: ${selected
      ? theme.tokens.component.link.accent.active
      : theme.tokens.component.link.muted.active};
  }

  ${variant === 'floating' &&
  selected &&
  css`
    background-color: ${theme.colors.blue100};
  `}
`;
export const ChonkStyledTabSelectionIndicator = styled('div')<{
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
          height: ${selectionIndicatorSize};

          bottom: 0;
          left: 50%;
          transform: translate(-50%, ${p.theme.space.xs});
        `
      : css`
          width: ${selectionIndicatorSize};
          height: 50%;

          left: -6px;
          top: 50%;
          transform: translateY(-50%);
        `};
`;

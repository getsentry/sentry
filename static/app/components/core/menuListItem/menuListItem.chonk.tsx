import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {FormSize, Theme} from 'sentry/utils/theme';

/**
 * Menu item priority. Determines the text and background color.
 */
export type Priority = 'primary' | 'danger' | 'default';

function getTextColor({
  theme,
  priority,
  disabled,
}: {
  disabled: boolean;
  priority: Priority;
  theme: Theme;
}) {
  if (disabled) {
    return theme.subText;
  }
  switch (priority) {
    case 'primary':
      return theme.tokens.content.accent;
    case 'danger':
      return theme.errorText;
    case 'default':
    default:
      return theme.tokens.content.primary;
  }
}

/**
 * Returns the appropriate vertical padding based on the size prop. To be used
 * as top/bottom padding/margin in InnerWrap
 */
const getVerticalPadding = (size: FormSize) => {
  switch (size) {
    case 'xs':
      return space(0.5);
    case 'sm':
      return space(0.75);
    case 'md':
    default:
      return space(1);
  }
};

export const ChonkInnerWrap = styled('div', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['disabled', 'isFocused', 'priority'].includes(prop),
})<{
  disabled: boolean;
  isFocused: boolean;
  priority: Priority;
  size: FormSize;
}>`
  display: flex;
  position: relative;
  padding: 0 ${space(1)} 0 ${space(1.5)};
  padding-top: ${p => getVerticalPadding(p.size)};
  padding-bottom: ${p => getVerticalPadding(p.size)};
  border-radius: ${p => p.theme.radius.md};
  box-sizing: border-box;

  font-size: ${p => p.theme.form[p.size ?? 'md'].fontSize};

  &,
  &:hover,
  &:focus,
  &:focus-visible {
    color: ${getTextColor};
    box-shadow: none;
    outline: none;
  }
  ${p => p.disabled && `cursor: default;`}

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }

  ${p =>
    p.isFocused &&
    css`
      z-index: 1;
      /* Background to hide the previous item's divider */
      ::before {
        background: ${p.theme.tokens.background.primary};
      }
    `}
`;

export const ChonkContentWrap = styled('div')<{
  isFocused: boolean;
  size: FormSize;
}>`
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  padding: 0;
`;

export const ChonkLeadingItems = styled('div')<{
  disabled: boolean;
  size: FormSize;
}>`
  display: flex;
  gap: ${space(1)};
  margin-right: ${space(1)};
  flex-shrink: 0;
  align-items: flex-start;

  ${p => p.disabled && `opacity: 0.5;`}
`;

export const ChonkLabel = styled('div')`
  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;

  ${p => p.theme.overflowEllipsis}
`;

export const ChonkLabelWrap = styled('div')`
  padding-right: ${space(1)};
  width: 100%;
  min-width: 0;
`;

export const ChonkDetails = styled('div')<{disabled: boolean; priority: Priority}>`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
  margin-bottom: 0;

  ${p => p.priority !== 'default' && `color: ${getTextColor(p)};`}
`;

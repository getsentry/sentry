import isPropValid from '@emotion/is-prop-valid';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import {space} from 'sentry/styles/space';
import type {FormSize} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

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
  theme: DO_NOT_USE_ChonkTheme;
}) {
  if (disabled) {
    return theme.subText;
  }
  switch (priority) {
    case 'primary':
      return theme.colors.content.accent;
    case 'danger':
      return theme.errorText;
    case 'default':
    default:
      return theme.textColor;
  }
}

export const ChonkInnerWrap = chonkStyled('div', {
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
    border-radius: ${p => p.theme.borderRadius};
    box-sizing: border-box;

    font-size: ${p => p.theme.form[p.size ?? 'md'].fontSize};

    &,
    &:hover {
      color: ${getTextColor};
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
      `
      z-index: 1;
      /* Background to hide the previous item's divider */
      ::before {
        background: ${p.theme.backgroundElevated};
      }
    `}
  `;

/**
 * Returns the appropriate vertical padding based on the size prop. To be used
 * as top/bottom padding/margin in ContentWrap and LeadingItems.
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

export const ChonkContentWrap = chonkStyled('div')<{
  isFocused: boolean;
  showDivider: boolean;
  size: FormSize;
}>`
    position: relative;
    width: 100%;
    height: ${p => p.theme.form[p.size ?? 'md'].height};
    min-width: 0;
    display: flex;
    gap: ${space(1)};
    justify-content: space-between;
    padding: ${p => getVerticalPadding(p.size)} 0;

    ${p =>
      p.showDivider &&
      !p.isFocused &&
      `
      li:not(:last-child) &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 1px;
        box-shadow:  0 1px 0 0 ${p.theme.innerBorder};
      }
    `}
  `;

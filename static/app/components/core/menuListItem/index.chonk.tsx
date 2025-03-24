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
    padding-top: ${p => getVerticalPadding(p.size)};
    padding-bottom: ${p => getVerticalPadding(p.size)};
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

export const ChonkContentWrap = chonkStyled('div')<{
  isFocused: boolean;
  showDivider: boolean;
  size: FormSize;
}>`
    position: relative;
    width: 100%;
    min-width: 0;
    display: flex;
    gap: ${space(1)};
    justify-content: space-between;
    padding: 0;

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

export const ChonkLeadingItems = chonkStyled('div')<{
  disabled: boolean;
  size: FormSize;
}>`
  display: flex;
  gap: ${space(1)};
  margin-right: ${space(1)};
  flex-shrink: 0;

  ${p => p.disabled && `opacity: 0.5;`}
`;

export const ChonkLabel = chonkStyled('div')`
  margin-bottom: 0;
  line-height: 1;
  white-space: nowrap;

  ${p => p.theme.overflowEllipsis}
`;

export const ChonkLabelWrap = chonkStyled('div')`
  padding-right: ${space(1)};
  width: 100%;
  min-width: 0;
`;

export const ChonkDetails = chonkStyled('div')<{disabled: boolean; priority: Priority}>`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.4;
  margin-bottom: 0;

  ${p => p.priority !== 'default' && `color: ${getTextColor(p)};`}
`;

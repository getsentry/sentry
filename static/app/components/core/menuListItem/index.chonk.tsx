import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';

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
  theme: Theme;
}) {
  if (disabled) {
    return theme.subText;
  }
  switch (priority) {
    case 'danger':
      return theme.errorText;
    case 'primary':
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

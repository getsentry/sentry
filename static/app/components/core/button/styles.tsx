import type {SerializedStyles, Theme} from '@emotion/react';
import {css} from '@emotion/react';

// eslint-disable-next-line boundaries/element-types
import {type SVGIconProps} from 'sentry/icons/svgIcon';
// eslint-disable-next-line boundaries/element-types
import {space} from 'sentry/styles/space';

import type {
  DO_NOT_USE_ButtonProps as ButtonProps,
  DO_NOT_USE_CommonButtonProps as CommonButtonProps,
  DO_NOT_USE_LinkButtonProps as LinkButtonProps,
} from './types';

const getBoxShadow = ({
  priority,
  borderless,
  translucentBorder,
  disabled,
  size,
  theme,
}: (ButtonProps | LinkButtonProps) & {theme: Theme}): SerializedStyles => {
  if (disabled || borderless || priority === 'link') {
    return css`
      box-shadow: none;
    `;
  }

  const themeName = disabled ? 'disabled' : priority || 'default';
  const {borderTranslucent} = theme.button[themeName];
  const translucentBorderString = translucentBorder
    ? `0 0 0 1px ${borderTranslucent},`
    : '';
  const dropShadow = size === 'xs' ? theme.dropShadowLight : theme.dropShadowMedium;

  return css`
    box-shadow: ${translucentBorderString} ${dropShadow};
    &:active {
      box-shadow: ${translucentBorderString} inset ${dropShadow};
    }
  `;
};

const getColors = ({
  size,
  priority,
  disabled,
  borderless,
  translucentBorder,
  theme,
}: (ButtonProps | LinkButtonProps) & {theme: Theme}): SerializedStyles => {
  const themeName = disabled ? 'disabled' : priority || 'default';
  const {color, colorActive, background, border, borderActive, focusBorder, focusShadow} =
    theme.button[themeName];

  const getFocusState = (): SerializedStyles => {
    switch (priority) {
      case 'primary':
      case 'danger':
        return css`
          border-color: ${focusBorder};
          box-shadow:
            ${focusBorder} 0 0 0 1px,
            ${focusShadow} 0 0 0 4px;
        `;
      default:
        if (translucentBorder) {
          return css`
            border-color: ${focusBorder};
            box-shadow: ${focusBorder} 0 0 0 2px;
          `;
        }
        return css`
          border-color: ${focusBorder};
          box-shadow: ${focusBorder} 0 0 0 1px;
        `;
    }
  };

  return css`
    color: ${color};
    background-color: ${priority === 'primary' || priority === 'danger'
      ? background
      : borderless
        ? 'transparent'
        : background};

    border: 1px solid ${borderless || priority === 'link' ? 'transparent' : border};

    ${translucentBorder &&
    css`
      border-width: 0;
    `}

    &:hover {
      color: ${color};
    }

    ${size !== 'zero' &&
    css`
      &:hover,
      &:active,
      &[aria-expanded='true'] {
        color: ${colorActive || color};
        border-color: ${borderless || priority === 'link' ? 'transparent' : borderActive};
      }

      &:focus-visible {
        color: ${colorActive || color};
        border-color: ${borderActive};
      }
    `}

    &:focus-visible {
      ${getFocusState()}
      z-index: 1;
    }
  `;
};

const getSizeStyles = ({
  size = 'md',
  translucentBorder,
  theme,
}: (ButtonProps | LinkButtonProps) & {theme: Theme}): SerializedStyles => {
  const buttonSize = size === 'zero' ? 'md' : size;
  const formStyles = theme.form[buttonSize];
  const buttonPadding = theme.buttonPadding[buttonSize];

  // If using translucent borders, rewrite size styles to
  // prevent layout shifts
  const borderStyles = translucentBorder
    ? {
        height: `calc(${formStyles.height} - 2px)`,
        minHeight: `calc(${formStyles.minHeight} - 2px)`,
        paddingTop: buttonPadding.paddingTop - 1,
        paddingBottom: buttonPadding.paddingBottom - 1,
        margin: 1,
      }
    : {};

  return css`
    ${formStyles}
    ${buttonPadding}
    ${borderStyles}
  `;
};

// This should only be used by the different underlying button implementations
// and not directly by consumers of the button component.
export function DO_NOT_USE_getButtonStyles(
  p: (ButtonProps | LinkButtonProps) & {theme: Theme}
): SerializedStyles {
  return css`
    position: relative;
    display: inline-block;
    border-radius: ${p.theme.borderRadius};
    text-transform: none;
    font-weight: ${p.theme.fontWeightBold};
    cursor: ${p.disabled ? 'not-allowed' : p.busy ? 'wait' : 'pointer'};
    opacity: ${(p.busy || p.disabled) && '0.65'};

    ${getColors(p)}
    ${getSizeStyles(p)}
    ${getBoxShadow(p)}

    transition:
      background 0.1s,
      border 0.1s,
      box-shadow 0.1s;

    ${p.priority === 'link' &&
    css`
      font-size: inherit;
      font-weight: inherit;
      padding: 0;
      height: auto;
      min-height: auto;
    `}
    ${p.size === 'zero' &&
    css`
      height: auto;
      min-height: auto;
      padding: ${space(0.25)};
    `}

  &:focus {
      outline: none;
    }
  `;
}

export const DO_NOT_USE_BUTTON_ICON_SIZES: Record<
  NonNullable<CommonButtonProps['size']>,
  SVGIconProps['size']
> = {
  zero: undefined,
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
};

import isPropValid from '@emotion/is-prop-valid';
import {css, cx, type LinariaClassName} from '@linaria/core';

import type {ButtonSize, ButtonVariant} from './types';

/**
 * Linaria port of `DO_NOT_USE_getButtonStyles`. The variant colors are exposed
 * as custom properties so the `::before` (chonk) and `::after` (surface)
 * pseudo-elements can share one set of rules:
 *
 * - `--button-surface`  surface color (`::after`)
 * - `--button-chonk`    chonk and border color (`::before`, `::after` border)
 * - `--button-elevation` resting height of the chonk, per size
 * - `--button-lift`     current lift of the surface; drops on hover/active
 */

// State classes have higher specificity than base and variant classes. This
// preserves their priority without merging CSS properties during rendering.
const buttonStyles = {
  base: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    font-weight: 500;
    cursor: pointer;
    border-width: 0;
    border-style: none;
    border-color: currentcolor;
    background-color: transparent;
    background-image: none;
    &:focus-visible {
      outline: none;
    }
    &::before {
      content: '';
      display: block;
      position: absolute;
      inset: 0;
      height: calc(100% - var(--button-elevation));
      top: var(--button-elevation);
      transform: translateY(calc(-1 * var(--button-elevation)));
      box-shadow: 0 var(--button-elevation) 0 0px var(--button-chonk);
      background-color: var(--button-chonk);
      border-radius: inherit;
    }
    &::after {
      content: '';
      display: block;
      position: absolute;
      inset: 0;
      background-color: var(--button-surface);
      border-radius: inherit;
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      transform: translateY(calc(-1 * var(--button-lift)));
      transition: transform 120ms cubic-bezier(0.8, -0.4, 0.5, 1);
    }
    &:focus-visible::after {
      box-shadow:
        0 var(--button-lift) 0 0 var(--button-chonk),
        0 var(--button-lift) 0 2px var(--ln-focus-default, #7553ff),
        0 0 0 2px var(--ln-focus-default, #7553ff);
    }
  `,
  disabled: css`
    &&&&&& {
      opacity: 0.6;
      cursor: not-allowed;
      --button-lift: 0px;
    }
  `,
  busy: css`
    &&&&&&& {
      cursor: progress;
      --button-lift: 0px;
    }
  `,
  pressed: css`
    &&&&& {
      --button-lift: 0px;
      &::after {
        transition: none;
      }
    }
  `,
  borderless: css`
    && {
      transform: translateY(0px);
      background-color: transparent;
      &:focus-visible {
        box-shadow:
          0 0 0 0 var(--ln-background-primary, #ffffff),
          0 0 0 2px var(--ln-focus-default, #7553ff);
      }
      &:hover {
        background-color: var(--ln-colors-gray100, #0000200f);
      }
      &:active {
        background-color: var(--ln-colors-gray200, #0000181a);
      }
      &::before {
        display: none;
      }
      &::after {
        display: none;
      }
    }
  `,
  borderlessInert: css`
    &&& {
      background-color: transparent;
      &:hover {
        background-color: inherit;
      }
      &:active {
        background-color: inherit;
      }
    }
  `,
  link: css`
    &&&& {
      padding: 0;
      height: auto;
      min-height: auto;
      min-width: auto;
    }
  `,
};

const buttonSizeStyles = {
  md: css`
    --button-elevation: 2px;
    --button-lift: 2px;
    border-radius: 8px;
    padding: 8px 16px;
    height: 36px;
    min-height: 36px;
    font-size: 0.875rem;
    line-height: 1rem;
    &:hover {
      --button-lift: calc(2px + 1px);
    }
    &:active {
      --button-lift: 0px;
    }
  `,
  sm: css`
    --button-elevation: 2px;
    --button-lift: 2px;
    border-radius: 6px;
    padding: 8px 12px;
    height: 32px;
    min-height: 32px;
    font-size: 0.875rem;
    line-height: 1rem;
    &:hover {
      --button-lift: calc(2px + 1px);
    }
    &:active {
      --button-lift: 0px;
    }
  `,
  xs: css`
    --button-elevation: 1px;
    --button-lift: 1px;
    border-radius: 5px;
    padding: 6px 8px;
    height: 28px;
    min-height: 28px;
    font-size: 0.75rem;
    line-height: 1rem;
    &:hover {
      --button-lift: calc(1px + 1px);
    }
    &:active {
      --button-lift: 0px;
    }
  `,
  zero: css`
    --button-elevation: 0px;
    --button-lift: 0px;
    border-radius: 4px;
    padding: 4px 6px;
    height: 24px;
    min-height: 24px;
    font-size: 0.75rem;
    line-height: 1rem;
    &:hover {
      --button-lift: calc(0px + 1px);
    }
    &:active {
      --button-lift: 0px;
    }
  `,
};

// Use min width as a progressive enhancement for square buttons.
const buttonSquareStyles = {
  md: css`
    padding: 0;
    min-width: 36px;
  `,
  sm: css`
    padding: 0;
    min-width: 32px;
  `,
  xs: css`
    padding: 0;
    min-width: 28px;
  `,
  zero: css`
    padding: 0;
    min-width: 24px;
  `,
};

const buttonVariantStyles = {
  primary: css`
    --button-surface: var(--ln-interactive-chonkyEmbossedAccentBackground, #7553ff);
    --button-chonk: var(--ln-interactive-chonkyEmbossedAccentChonk, #5827d6);
    color: var(--ln-interactive-chonkyEmbossedAccentContent, #ffffff);
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: var(--ln-focus-onVibrantLight, #ffffff);
      box-shadow: none;
    }
  `,
  secondary: css`
    --button-surface: var(--ln-interactive-chonkyEmbossedNeutralBackground, #ffffff);
    --button-chonk: var(--ln-interactive-chonkyEmbossedNeutralChonk, #dad9de);
    color: var(--ln-interactive-chonkyEmbossedNeutralContentPrimary, #181225);
  `,
  warning: css`
    --button-surface: var(--ln-interactive-chonkyEmbossedWarningBackground, #ffce00);
    --button-chonk: var(--ln-interactive-chonkyEmbossedWarningChonk, #d59600);
    color: var(--ln-interactive-chonkyEmbossedWarningContent, #000000);
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: var(--ln-focus-onVibrantDark, #000000);
      box-shadow: none;
    }
  `,
  danger: css`
    --button-surface: var(--ln-interactive-chonkyEmbossedDangerBackground, #ff002b);
    --button-chonk: var(--ln-interactive-chonkyEmbossedDangerChonk, #c10000);
    color: var(--ln-interactive-chonkyEmbossedDangerContent, #ffffff);
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: var(--ln-focus-onVibrantLight, #ffffff);
      box-shadow: none;
    }
  `,
  transparent: css`
    --button-surface: var(--ln-interactive-transparentNeutralBackgroundRest, #00002000);
    --button-chonk: var(--ln-interactive-transparentNeutralBackgroundRest, #00002000);
    color: var(--ln-interactive-transparentNeutralContentPrimary, #302e36);
  `,
  link: css`
    --button-surface: transparent;
    --button-chonk: transparent;
    color: var(--ln-interactive-linkAccentRest, #653de9);
  `,
};

/**
 * The content wrapper, the button's only child (`> span:last-child` in the
 * Emotion styles). It moves with the surface.
 */
const buttonContentStyles = {
  base: css`
    z-index: 1;
    position: relative;
    display: inherit;
    align-items: inherit;
    justify-content: inherit;
    flex: 1;
    gap: inherit;
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
    height: 100%;
    transform: translateY(calc(-1 * var(--button-lift)));
    transition: transform 120ms cubic-bezier(0.8, -0.4, 0.5, 1);
  `,
  borderlessBase: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 100%;
    white-space: nowrap;
    transform: translateY(0px);
  `,
  busy: css`
    overflow: visible;
  `,
  hidden: css`
    visibility: hidden;
  `,
  link: css`
    color: inherit;
    transform: none;
  `,
  pressed: css`
    transition: none;
  `,
};

export interface ButtonStyleState {
  busy: boolean | undefined;
  disabled: boolean;
  pressed: boolean;
  size: ButtonSize;
  square: boolean;
  variant: ButtonVariant;
}

function isBorderless(variant: ButtonVariant) {
  return variant === 'transparent' || variant === 'link';
}

export function getButtonClassName(
  s: ButtonStyleState,
  className?: string,
  customCss?: LinariaClassName
) {
  const borderless = isBorderless(s.variant);
  return cx(
    buttonStyles.base,
    buttonSizeStyles[s.size],
    s.square && buttonSquareStyles[s.size],
    buttonVariantStyles[s.variant],
    borderless && buttonStyles.borderless,
    borderless &&
      (s.busy || s.disabled || s.variant === 'link') &&
      buttonStyles.borderlessInert,
    s.variant === 'link' && buttonStyles.link,
    s.pressed && buttonStyles.pressed,
    s.disabled && buttonStyles.disabled,
    s.busy && buttonStyles.busy,
    customCss,
    className
  );
}

export function getButtonContentClassName(
  s: ButtonStyleState,
  {hideWhenBusy}: {hideWhenBusy: boolean}
) {
  return cx(
    isBorderless(s.variant)
      ? buttonContentStyles.borderlessBase
      : buttonContentStyles.base,
    s.busy && buttonContentStyles.busy,
    s.busy && hideWhenBusy && buttonContentStyles.hidden,
    s.variant === 'link' && buttonContentStyles.link,
    s.pressed && buttonContentStyles.pressed
  );
}

// Button props that are not DOM attributes (some, like `size`, would pass
// isPropValid).
const BUTTON_PROPS: ReadonlySet<string> = new Set([
  'analyticsEventKey',
  'analyticsEventName',
  'analyticsParams',
  'busy',
  'icon',
  'size',
  'tooltipProps',
  'variant',
]);

function isTrue(value: unknown) {
  return value === true || value === 'true';
}

/**
 * Drops the props the Emotion `styled('button')` would not have forwarded.
 */
export function getButtonDomProps<P extends Record<string, any>>(
  props: P,
  omit: ReadonlySet<string> = BUTTON_PROPS
): Partial<P> {
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (!omit.has(key) && isPropValid(key)) {
      domProps[key] = props[key];
    }
  }
  return domProps as Partial<P>;
}

export function getButtonStyleState(
  props: {
    'aria-checked'?: unknown;
    'aria-disabled'?: unknown;
    'aria-expanded'?: unknown;
    busy?: boolean;
    disabled?: boolean;
    variant?: ButtonVariant;
  },
  size: ButtonSize,
  hasChildren: boolean
): ButtonStyleState {
  return {
    busy: props.busy,
    // A button that is only aria-disabled stays focusable (so its tooltip can
    // open on focus) but must look and hover like a disabled one.
    disabled: !!props.disabled || isTrue(props['aria-disabled']),
    pressed: isTrue(props['aria-expanded']) || isTrue(props['aria-checked']),
    size,
    square: !hasChildren,
    variant: props.variant ?? 'secondary',
  };
}

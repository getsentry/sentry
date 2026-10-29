import type {ElementType, CSSProperties, ReactNode} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, styled} from '@yak/react';

import type {Theme} from '@sentry/scraps/theme';
import {withYakTheme} from '@sentry/scraps/yak';

import type {ButtonSize, ButtonVariant} from './types';
interface StyleProps {
  size: ButtonSize;
  'aria-checked'?: unknown;
  'aria-disabled'?: unknown;
  'aria-expanded'?: unknown;
  busy?: boolean;
  disabled?: boolean;
  shapeVariant?: 'rectangular' | 'square';
  theme?: Theme;
  variant?: ButtonVariant;
}
const buttonStyles = {
  base: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    font-weight: 500;
    color: var(--button-content);
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
        0 var(--button-lift) 0 2px ${p => p.theme.tokens.focus.default},
        0 0 0 2px ${p => p.theme.tokens.focus.default};
    }
  `,
  // Emotion styled wrappers must be able to override these variant rules.
  borderless: css`
    & {
      transform: translateY(0px);
      background-color: transparent;
      &:focus-visible {
        box-shadow:
          0 0 0 0 ${p => p.theme.tokens.background.primary},
          0 0 0 2px ${p => p.theme.tokens.focus.default};
      }
      &:hover {
        background-color: ${p => p.theme.colors.gray100};
      }
      &:active {
        background-color: ${p => p.theme.colors.gray200};
      }
      &::before {
        display: none;
      }
      &::after {
        display: none;
      }
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
    --button-surface: ${p => p.theme.tokens.interactive.chonky.embossed.accent.background};
    --button-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.accent.chonk};
    --button-content: ${p => p.theme.tokens.interactive.chonky.embossed.accent.content};
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: ${p => p.theme.tokens.focus.onVibrant.light};
      box-shadow: none;
    }
  `,
  secondary: css`
    --button-surface: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
    --button-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
    --button-content: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.primary};
  `,
  warning: css`
    --button-surface: ${p => p.theme.tokens.interactive.chonky.embossed.warning.background};
    --button-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.warning.chonk};
    --button-content: ${p => p.theme.tokens.interactive.chonky.embossed.warning.content};
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: ${p => p.theme.tokens.focus.onVibrant.dark};
      box-shadow: none;
    }
  `,
  danger: css`
    --button-surface: ${p => p.theme.tokens.interactive.chonky.embossed.danger.background};
    --button-chonk: ${p => p.theme.tokens.interactive.chonky.embossed.danger.chonk};
    --button-content: ${p => p.theme.tokens.interactive.chonky.embossed.danger.content};
    &::after {
      border-width: 1px;
      border-style: solid;
      border-color: var(--button-chonk);
      box-shadow: none;
    }
    &:focus-visible::after {
      border-width: 2px;
      border-style: dotted;
      border-color: ${p => p.theme.tokens.focus.onVibrant.light};
      box-shadow: none;
    }
  `,
  transparent: css`
    --button-surface: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
    --button-chonk: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
    --button-content: ${p => p.theme.tokens.interactive.transparent.neutral.content.primary};
  `,
  link: css`
    --button-surface: transparent;
    --button-chonk: transparent;
    --button-content: ${p => p.theme.tokens.interactive.link.accent.rest};
  `,
};

// Emit state rules after sizes and variants. Use the same selector specificity
// as Emotion so styled wrappers can override both resting and pointer states.
const buttonStateStyles = {
  link: css`
    padding: 0;
    height: auto;
    min-height: auto;
    min-width: auto;
  `,
  borderlessInert: css`
    background-color: transparent;
    &:hover,
    &:active {
      background-color: inherit;
    }
  `,
  pressed: css`
    --button-lift: 0px;
    &:hover,
    &:active {
      --button-lift: 0px;
    }
    &::after {
      transition: none;
    }
  `,
  disabled: css`
    opacity: 0.6;
    cursor: not-allowed;
    --button-lift: 0px;
    &:hover,
    &:active {
      --button-lift: 0px;
    }
  `,
  busy: css`
    cursor: progress;
    --button-lift: 0px;
    &:hover,
    &:active {
      --button-lift: 0px;
    }
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

const borderless = (p: StyleProps) => p.variant === 'link' || p.variant === 'transparent';
const disabled = (p: StyleProps) =>
  !!p.disabled || p['aria-disabled'] === true || p['aria-disabled'] === 'true';
const pressed = (p: StyleProps) =>
  p['aria-expanded'] === true ||
  p['aria-expanded'] === 'true' ||
  p['aria-checked'] === true ||
  p['aria-checked'] === 'true';
type YakButtonProps = StyleProps & {
  [key: string]: unknown;
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};
const StyledYakButton = styled(function YakButtonElement({
  as: Component = 'button',
  theme: _,
  ...props
}: YakButtonProps) {
  const forwarded: Record<string, unknown> = {};
  for (const key in props) {
    const linkProp =
      typeof Component !== 'string' &&
      [
        'analyticsEventKey',
        'analyticsEventName',
        'analyticsParams',
        'busy',
        'external',
        'replace',
        'preventScrollReset',
        'openInNewTab',
        'variant',
      ].includes(key);
    if (linkProp || (key !== 'size' && key !== 'shapeVariant' && isPropValid(key))) {
      forwarded[key] = props[key];
    }
  }
  return <Component {...forwarded} />;
})`
  ${buttonStyles.base};
  ${p =>
    !disabled(p) &&
    !p.busy &&
    css<typeof p>`
      &:hover,
      &:focus-visible {
        color: var(--button-content);
      }
    `}
  ${p =>
    p.size === 'md' &&
    css<typeof p>`
      ${buttonSizeStyles.md};
    `}
  ${p =>
    p.size === 'sm' &&
    css<typeof p>`
      ${buttonSizeStyles.sm};
    `}
  ${p =>
    p.size === 'xs' &&
    css<typeof p>`
      ${buttonSizeStyles.xs};
    `}
  ${p =>
    p.size === 'zero' &&
    css<typeof p>`
      ${buttonSizeStyles.zero};
    `}
  ${p =>
    p.shapeVariant === 'square' &&
    p.size === 'md' &&
    css<typeof p>`
      ${buttonSquareStyles.md};
    `}
  ${p =>
    p.shapeVariant === 'square' &&
    p.size === 'sm' &&
    css<typeof p>`
      ${buttonSquareStyles.sm};
    `}
  ${p =>
    p.shapeVariant === 'square' &&
    p.size === 'xs' &&
    css<typeof p>`
      ${buttonSquareStyles.xs};
    `}
  ${p =>
    p.shapeVariant === 'square' &&
    p.size === 'zero' &&
    css<typeof p>`
      ${buttonSquareStyles.zero};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'primary' &&
    css<typeof p>`
      ${buttonVariantStyles.primary};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'secondary' &&
    css<typeof p>`
      ${buttonVariantStyles.secondary};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'warning' &&
    css<typeof p>`
      ${buttonVariantStyles.warning};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'danger' &&
    css<typeof p>`
      ${buttonVariantStyles.danger};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'transparent' &&
    css<typeof p>`
      ${buttonVariantStyles.transparent};
    `}
  ${p =>
    (p.variant ?? 'secondary') === 'link' &&
    css<typeof p>`
      ${buttonVariantStyles.link};
    `}
  ${p =>
    borderless(p) &&
    css<typeof p>`
      ${buttonStyles.borderless};
    `}
  ${p =>
    borderless(p) &&
    (p.busy || disabled(p) || p.variant === 'link') &&
    css<typeof p>`
      ${buttonStateStyles.borderlessInert};
    `}
  ${p =>
    p.variant === 'link' &&
    css<typeof p>`
      ${buttonStateStyles.link};
    `}
  ${p =>
    pressed(p) &&
    css<typeof p>`
      ${buttonStateStyles.pressed};
    `}
  ${p =>
    disabled(p) &&
    css<typeof p>`
      ${buttonStateStyles.disabled};
    `}
  ${p =>
    p.busy &&
    css<typeof p>`
      ${buttonStateStyles.busy};
    `}
  > span:last-child {
    ${p =>
      !borderless(p) &&
      css<typeof p>`
        ${buttonContentStyles.base};
      `}
    ${p =>
      borderless(p) &&
      css<typeof p>`
        ${buttonContentStyles.borderlessBase};
      `}
    ${p =>
      p.busy &&
      css<typeof p>`
        ${buttonContentStyles.busy};
      `}
    ${p =>
      p.busy &&
      css<typeof p>`
        ${buttonContentStyles.hidden};
      `}
    ${p =>
      p.variant === 'link' &&
      css<typeof p>`
        ${buttonContentStyles.link};
      `}
    ${p =>
      pressed(p) &&
      css<typeof p>`
        ${buttonContentStyles.pressed};
      `}
  }
`;

export const YakButton = withYakTheme(StyledYakButton);

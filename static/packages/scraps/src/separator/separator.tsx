import isPropValid from '@emotion/is-prop-valid';
import {css} from '@linaria/core';

import {resolveSpacing, type ContainerProps} from '@sentry/scraps/layout/container';
import {
  addLayoutProp,
  addStyles,
  createLayoutStyle,
  finishLayoutStyle,
} from '@sentry/scraps/layout/linariaLayout';
import {type Shorthand, useResponsivePropValue} from '@sentry/scraps/layout/styles';
import type {BorderVariant, SpaceSize} from '@sentry/scraps/theme';

export type SeparatorProps = Pick<ContainerProps, 'border' | 'margin' | 'padding'> & {
  orientation: 'horizontal' | 'vertical';
  children?: never;
} & Omit<React.HTMLAttributes<HTMLHRElement>, 'aria-orientation'>;

type Margin = SpaceSize | 'auto' | '0';

const styles = {
  base: css`
    flex-shrink: 0;
    align-self: stretch;
    border-style: none;
  `,
  horizontal: css`
    width: auto;
    height: 1px;
  `,
  vertical: css`
    width: 1px;
    height: auto;
  `,
};

// Longhands keep parity with the StyleX spike. `!important` matches Emotion.

const horizontalLineStyles = {
  none: css`
    border-bottom-style: none !important;
  `,
  primary: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-primary, #dad9de) !important;
  `,
  secondary: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-secondary, #e6e6e9) !important;
  `,
  muted: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-secondary, #e6e6e9) !important;
  `,
  accent: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-accentVibrant, #7553ff) !important;
  `,
  danger: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-dangerVibrant, #ff002b) !important;
  `,
  promotion: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-promotionVibrant, #ff70bc) !important;
  `,
  success: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-successVibrant, #00f261) !important;
  `,
  warning: css`
    border-bottom-width: 1px !important;
    border-bottom-style: solid !important;
    border-bottom-color: var(--ln-border-warningVibrant, #ffce00) !important;
  `,
};

const verticalLineStyles = {
  none: css`
    border-left-style: none !important;
  `,
  primary: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-primary, #dad9de) !important;
  `,
  secondary: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-secondary, #e6e6e9) !important;
  `,
  muted: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-secondary, #e6e6e9) !important;
  `,
  accent: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-accentVibrant, #7553ff) !important;
  `,
  danger: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-dangerVibrant, #ff002b) !important;
  `,
  promotion: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-promotionVibrant, #ff70bc) !important;
  `,
  success: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-successVibrant, #00f261) !important;
  `,
  warning: css`
    border-left-width: 1px !important;
    border-left-style: solid !important;
    border-left-color: var(--ln-border-warningVibrant, #ffce00) !important;
  `,
};

function resolveMarginSize(size: Margin): string {
  return size === 'auto' || size === '0' ? size : resolveSpacing(size);
}

function resolveMargin(margin: Shorthand<Margin, 4>): string {
  return margin
    .split(' ')
    .map(size => resolveMarginSize(size as Margin))
    .join(' ');
}

type SeparatorElementProps = Omit<SeparatorProps, 'border'> & {border: BorderVariant};

function SeparatorElement({
  orientation,
  border: borderVariant,
  margin,
  padding,
  className,
  style,
  ...props
}: SeparatorElementProps) {
  const acc = createLayoutStyle();
  addStyles(
    acc,
    styles.base,
    orientation === 'horizontal' ? styles.horizontal : styles.vertical,
    (orientation === 'horizontal' ? horizontalLineStyles : verticalLineStyles)[
      borderVariant
    ]
  );
  addLayoutProp(acc, 'padding', padding, {
    fixed: 'padding',
    resolve: resolveSpacing,
  });
  addLayoutProp(acc, 'margin', margin ?? '0', {
    fixed: 'margin',
    resolve: resolveMargin,
  });
  const merged = finishLayoutStyle(acc, className, style);

  // Drop the props an Emotion `styled` would not have forwarded, such as those
  // of a `styled(Separator)` wrapper.
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (key === 'ref' || isPropValid(key)) {
      domProps[key] = (props as Record<string, unknown>)[key];
    }
  }

  return (
    <hr
      aria-orientation={orientation}
      {...domProps}
      className={merged.className}
      style={merged.style}
    />
  );
}

/**
 * A responsive `border` is resolved in JS for the active breakpoint, so the
 * common (static) case does not subscribe to breakpoint changes.
 */
function ResponsiveBorderSeparator({border: borderProp, ...props}: SeparatorProps) {
  const borderVariant = useResponsivePropValue(borderProp ?? 'primary');
  return <SeparatorElement {...props} border={borderVariant} />;
}

export function Separator(props: SeparatorProps) {
  if (typeof props.border === 'object' && props.border !== null) {
    return <ResponsiveBorderSeparator {...props} />;
  }
  return <SeparatorElement {...props} border={props.border ?? 'primary'} />;
}

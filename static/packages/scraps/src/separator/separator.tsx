import isPropValid from '@emotion/is-prop-valid';
import * as stylex from '@stylexjs/stylex';

import {resolveSpacing, type ContainerProps} from '@sentry/scraps/layout/container';
import {type Shorthand, useResponsivePropValue} from '@sentry/scraps/layout/styles';
import {
  addLayoutProp,
  addStyles,
  createLayoutStyle,
  finishLayoutStyle,
} from '@sentry/scraps/layout/stylexLayout';
import type {BorderVariant, SpaceSize} from '@sentry/scraps/theme';
import {border} from '@sentry/scraps/theme/tokens.stylex';

export type SeparatorProps = Pick<ContainerProps, 'border' | 'margin' | 'padding'> & {
  orientation: 'horizontal' | 'vertical';
  children?: never;
} & Omit<React.HTMLAttributes<HTMLHRElement>, 'aria-orientation'>;

type Margin = SpaceSize | 'auto' | '0';

const styles = stylex.create({
  base: {
    flexShrink: 0,
    alignSelf: 'stretch',
    // Only the separator line is drawn; reset the user agent `hr` border.
    borderStyle: 'none',
  },
  horizontal: {width: 'auto', height: '1px'},
  vertical: {width: '1px', height: 'auto'},
});

// StyleX does not support the `border-*` shorthands, so the line is set through
// its longhands. `!important` keeps parity with the Emotion version.
const bottomLine = (color: string) => ({
  borderBottomWidth: '1px !important',
  borderBottomStyle: 'solid !important',
  borderBottomColor: `${color} !important`,
});

const leftLine = (color: string) => ({
  borderLeftWidth: '1px !important',
  borderLeftStyle: 'solid !important',
  borderLeftColor: `${color} !important`,
});

const horizontalLineStyles = stylex.create({
  none: {borderBottomStyle: 'none !important'},
  primary: bottomLine(border.primary),
  secondary: bottomLine(border.secondary),
  muted: bottomLine(border.secondary),
  accent: bottomLine(border.accentVibrant),
  danger: bottomLine(border.dangerVibrant),
  promotion: bottomLine(border.promotionVibrant),
  success: bottomLine(border.successVibrant),
  warning: bottomLine(border.warningVibrant),
});

const verticalLineStyles = stylex.create({
  none: {borderLeftStyle: 'none !important'},
  primary: leftLine(border.primary),
  secondary: leftLine(border.secondary),
  muted: leftLine(border.secondary),
  accent: leftLine(border.accentVibrant),
  danger: leftLine(border.dangerVibrant),
  promotion: leftLine(border.promotionVibrant),
  success: leftLine(border.successVibrant),
  warning: leftLine(border.warningVibrant),
});

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

import type * as React from 'react';

import {
  addContainerStyles,
  LayoutElement,
  omitContainerProps,
  type ContainerElement,
  type ContainerProps,
} from '@sentry/scraps/layout/container';
import type {SurfaceVariant} from '@sentry/scraps/theme';

import {addLayoutProp, useLayoutStyle} from './yakLayout';

interface FlatSurfaceProps<T extends ContainerElement = 'div'> extends Omit<
  ContainerProps<T>,
  'background' | 'border'
> {
  elevation?: never;
  variant?: SurfaceVariant;
}

interface OverlaySurfaceProps<T extends ContainerElement = 'div'> extends Omit<
  ContainerProps<T>,
  'background' | 'border'
> {
  variant: 'overlay';
  elevation?: 'low' | 'medium' | 'high';
}

interface FlatSurfacePropsWithRenderFunction {
  children: (props: {className: string; style?: React.CSSProperties}) => React.ReactNode;
  elevation?: never;
  variant?: SurfaceVariant;
}

interface OverlaySurfacePropsWithRenderFunction {
  children: (props: {className: string}) => React.ReactNode;
  variant: 'overlay';
  elevation?: 'low' | 'medium' | 'high';
}

type SurfaceProps<T extends ContainerElement = 'div'> =
  | FlatSurfaceProps<T>
  | OverlaySurfaceProps<T>;

/**
 * Surface is a layout primitive that provides background colors and optional elevation
 * shadows for layered UI elements. It extends Container with variant-specific styling.
 *
 * @param variant - Surface background variant:
 *   - `primary` | `secondary` | `tertiary`: Flat surfaces with no elevation
 *   - `overlay`: Elevated surface with shadow (e.g., modals, popovers, dropdowns)
 *
 * @param elevation - Shadow depth for overlay variant only. Defaults to `low` for overlays.
 *   - `low`: Subtle shadow for slightly elevated content (default)
 *   - `medium`: Raised shadow for interactive overlays
 *   - `high`: Prominent shadow for modals and dialogs
 *
 * @param radius - Border radius size. Defaults to `md` for overlay variant, no default for others.
 *
 * @example
 * // Flat surface
 * <Surface variant="primary">Content</Surface>
 *
 * // Elevated overlay with low elevation (default)
 * <Surface variant="overlay" elevation="low">Tooltip content</Surface>
 *
 * // Elevated overlay with medium elevation
 * <Surface variant="overlay" elevation="low">Tooltip content</Surface>
 *
 * // Elevated overlay with high elevation
 * <Surface variant="overlay" elevation="high">Modal content</Surface>
 *
 */

const omitted = new Set<string>([...omitContainerProps, 'variant', 'elevation']);
export function Surface<T extends ContainerElement = 'div'>(
  props:
    | SurfaceProps<T>
    | FlatSurfacePropsWithRenderFunction
    | OverlaySurfacePropsWithRenderFunction
) {
  const acc = useLayoutStyle(typeof props.children === 'function');
  const {variant, elevation, ...rest} = props;
  const layout =
    variant === 'overlay'
      ? {border: 'primary' as const, radius: 'md' as const, ...rest}
      : rest;
  addContainerStyles(acc, {display: undefined, ...layout});
  addLayoutProp(acc, 'background', variant, (v, theme) => theme.tokens.background[v]);
  addLayoutProp(
    acc,
    'boxShadow',
    elevation ?? (variant === 'overlay' ? 'low' : undefined),
    (v, theme) => theme.shadow[v]
  );
  return <LayoutElement elementProps={props} layoutStyle={acc} omitProps={omitted} />;
}

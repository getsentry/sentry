import {
  addContainerStyles,
  omitContainerProps,
  resolveBackground,
  LayoutElement,
  type ContainerElement,
  type ContainerProps,
} from '@sentry/scraps/layout/container';
import type {SurfaceVariant} from '@sentry/scraps/theme';
import {shadow} from '@sentry/scraps/theme/tokens.linaria';

import {addLayoutProp, createLayoutStyle} from './linariaLayout';

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

interface FlatSurfacePropsWithRenderFunction extends Pick<
  ContainerProps,
  'customCss' | 'css' | 'className'
> {
  children: (props: {className: string; style?: React.CSSProperties}) => React.ReactNode;
  elevation?: never;
  variant?: SurfaceVariant;
}

interface OverlaySurfacePropsWithRenderFunction extends Pick<
  ContainerProps,
  'customCss' | 'css' | 'className'
> {
  children: (props: {className: string; style?: React.CSSProperties}) => React.ReactNode;
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

function isRenderFunction(
  props:
    | SurfaceProps<any>
    | FlatSurfacePropsWithRenderFunction
    | OverlaySurfacePropsWithRenderFunction
): props is FlatSurfacePropsWithRenderFunction | OverlaySurfacePropsWithRenderFunction {
  return typeof props.children === 'function';
}

const OMIT_SURFACE_PROPS: ReadonlySet<string> = new Set<string>([
  ...omitContainerProps,
  'elevation',
  'variant',
]);

function SurfaceComponent<T extends ContainerElement = 'div'>(
  props:
    | SurfaceProps<T>
    | FlatSurfacePropsWithRenderFunction
    | OverlaySurfacePropsWithRenderFunction
) {
  const acc = createLayoutStyle(typeof props.children === 'function');
  const isOverlay = props.variant === 'overlay';

  // The render-prop form takes no container props, only the surface styles.
  const {variant: _variant, elevation: _elevation, ...rest} = props as SurfaceProps<T>;
  addContainerStyles(acc, {
    ...(isRenderFunction(props) ? {} : rest),
    border: isOverlay ? 'primary' : undefined,
    radius: rest.radius ?? (isOverlay ? 'md' : undefined),
  });

  addLayoutProp(acc, 'backgroundColor', props.variant, {
    fixed: 'background',
    resolve: resolveBackground,
  });
  addLayoutProp(acc, 'boxShadow', props.elevation ?? (isOverlay ? 'low' : undefined), {
    fixed: 'elevation',
    resolve: value => shadow[value],
  });

  return (
    <LayoutElement
      elementProps={props}
      layoutStyle={acc}
      omitProps={OMIT_SURFACE_PROPS}
    />
  );
}

export const Surface = SurfaceComponent as <T extends ContainerElement = 'div'>(
  props:
    | SurfaceProps<T>
    | FlatSurfacePropsWithRenderFunction
    | OverlaySurfacePropsWithRenderFunction
) => React.ReactElement;

import styled from '@emotion/styled';

import {
  Container,
  type ContainerElement,
  type ContainerProps,
} from '@sentry/scraps/layout/container';

import type {SurfaceVariant} from 'sentry/utils/theme';

interface FlatSurfaceProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerProps<T>, 'background' | 'border'> {
  elevation?: never;
  variant?: SurfaceVariant;
}

interface OverlaySurfaceProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerProps<T>, 'background' | 'border'> {
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
export const Surface = styled((props: SurfaceProps<any>) => {
  const {variant, elevation: _, ...rest} = props;
  if (variant === 'overlay') {
    return <Container border="primary" radius={props.radius ?? 'md'} {...rest} />;
  }
  return <Container radius={props.radius} {...props} />;
})<SurfaceProps<any>>`
  background: ${p => (p.variant ? p.theme.tokens.background[p.variant] : undefined)};
  box-shadow: ${p =>
    p.variant === 'overlay' ? p.theme.shadow[p.elevation ?? 'low'] : undefined};
` as unknown as <T extends ContainerElement = 'div'>(
  props: SurfaceProps<T>
) => React.ReactElement;

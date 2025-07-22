import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

// We alias None -> 0 to make it slighly more terse and easier to read.
type RadiusSize = keyof DO_NOT_USE_ChonkTheme['radius'] | '0';
type SpacingSize = keyof Theme['space'] | '0';
type Breakpoint = keyof Theme['breakpoints'];

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
type Spacing =
  | `${SpacingSize} ${SpacingSize} ${SpacingSize} ${SpacingSize}`
  | `${SpacingSize} ${SpacingSize} ${SpacingSize}`
  | `${SpacingSize} ${SpacingSize}`
  | `${SpacingSize}`;

type Radius =
  | `${RadiusSize} ${RadiusSize} ${RadiusSize} ${RadiusSize}`
  | `${RadiusSize} ${RadiusSize} ${RadiusSize}`
  | `${RadiusSize} ${RadiusSize}`
  | `${RadiusSize}`;

type Responsive<T> = T | Record<Breakpoint, T | undefined>;

/* eslint-disable typescript-sort-keys/interface */
interface BaseContainerProps {
  background?: Responsive<keyof Theme['tokens']['background']>;
  children?: React.ReactNode;
  display?: Responsive<
    'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid'
  >;
  // Margin
  m?: Responsive<Spacing>;
  mb?: Responsive<Spacing>;
  ml?: Responsive<Spacing>;
  mr?: Responsive<Spacing>;
  mt?: Responsive<Spacing>;

  // Padding
  p?: Responsive<Spacing>;
  pb?: Responsive<Spacing>;
  pl?: Responsive<Spacing>;
  pr?: Responsive<Spacing>;
  pt?: Responsive<Spacing>;

  // Position
  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;

  // Overflow
  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;

  // Radius
  radius?: Responsive<Radius>;

  // Width
  width?: Responsive<CSSProperties['width']>;
  minWidth?: Responsive<CSSProperties['minWidth']>;
  maxWidth?: Responsive<CSSProperties['maxWidth']>;
}
/* eslint-enable typescript-sort-keys/interface */

type ContainerElement =
  | 'article'
  | 'aside'
  | 'div'
  | 'figure'
  | 'footer'
  | 'header'
  | 'li'
  | 'main'
  | 'nav'
  | 'ol'
  | 'section'
  | 'span'
  | 'summary'
  | 'ul';

type ContainerProps<T extends ContainerElement = 'div'> = BaseContainerProps & {
  as?: T;
  ref?: React.Ref<HTMLElementTagNameMap[T] | null>;
} & React.HTMLAttributes<HTMLElementTagNameMap[T]>;

const omitContainerProps = new Set<keyof ContainerProps<any>>([
  'as',
  'background',
  'display',
  'm',
  'mb',
  'ml',
  'mr',
  'mt',
  'p',
  'pb',
  'pl',
  'pr',
  'pt',
  'overflow',
  'overflowX',
  'overflowY',
  'radius',
]);

export const Container = styled(
  <T extends ContainerElement = 'div'>(props: ContainerProps<T>) => {
    const Component = (props.as ?? 'div') as T;
    return <Component {...(props as any)}>{props.children}</Component>;
  },
  {
    shouldForwardProp: prop => {
      if (omitContainerProps.has(prop as unknown as keyof ContainerProps<any>)) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)<ContainerProps>`
  display: ${p => p.display};

  overflow: ${p => p.overflow};
  overflow-x: ${p => p.overflowX};
  overflow-y: ${p => p.overflowY};

  background: ${p =>
    isString(p.background) ? p.theme.tokens.background[p.background] : undefined};

  border-radius: ${p => (isString(p.radius) ? getRadius(p.radius, p.theme) : undefined)};

  padding: ${p => (isString(p.p) ? getSpacing(p.p, p.theme) : undefined)};
  padding-top: ${p => (isString(p.pt) ? getSpacing(p.pt, p.theme) : undefined)};
  padding-bottom: ${p => (isString(p.pb) ? getSpacing(p.pb, p.theme) : undefined)};
  padding-left: ${p => (isString(p.pl) ? getSpacing(p.pl, p.theme) : undefined)};
  padding-right: ${p => (isString(p.pr) ? getSpacing(p.pr, p.theme) : undefined)};

  margin: ${p => (isString(p.m) ? getSpacing(p.m, p.theme) : undefined)};
  margin-top: ${p => (isString(p.mt) ? getSpacing(p.mt, p.theme) : undefined)};
  margin-bottom: ${p => (isString(p.mb) ? getSpacing(p.mb, p.theme) : undefined)};
  margin-left: ${p => (isString(p.ml) ? getSpacing(p.ml, p.theme) : undefined)};
  margin-right: ${p => (isString(p.mr) ? getSpacing(p.mr, p.theme) : undefined)};

  ${p => containerBreakpointCSS(p.theme, p, {current: 'xs', previous: 'sm'})}
  ${p => containerBreakpointCSS(p.theme, p, {current: 'sm', previous: 'md'})}
  ${p => containerBreakpointCSS(p.theme, p, {current: 'md', previous: 'lg'})}
  ${p => containerBreakpointCSS(p.theme, p, {current: 'lg', previous: 'xl'})}
  ${p => containerBreakpointCSS(p.theme, p, {current: 'xl'})} /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T>
) => React.ReactElement;

function containerBreakpointCSS(
  theme: Theme,
  p: ContainerProps,
  {
    current,
    previous,
  }: {
    current: Breakpoint;
    previous?: Breakpoint;
  }
) {
  const mediaQuery = previous
    ? `(max-width: ${theme.breakpoints[previous]}) and(min-width: ${theme.breakpoints[current]})`
    : `(min-width: ${theme.breakpoints[current]})`;

  return css`
    @media ${mediaQuery} {
      display: ${p.display};

      overflow: ${p.overflow};
      overflow-x: ${p.overflowX};
      overflow-y: ${p.overflowY};

      background: ${isString(p.background)
        ? theme.tokens.background[p.background]
        : undefined};

      border-radius: ${isString(p.radius) ? getRadius(p.radius, theme) : undefined};

      padding: ${isString(p.p) ? getSpacing(p.p, theme) : undefined};
      padding-top: ${isString(p.pt) ? getSpacing(p.pt, theme) : undefined};
      padding-bottom: ${isString(p.pb) ? getSpacing(p.pb, theme) : undefined};
      padding-left: ${isString(p.pl) ? getSpacing(p.pl, theme) : undefined};
      padding-right: ${isString(p.pr) ? getSpacing(p.pr, theme) : undefined};

      margin: ${isString(p.m) ? getSpacing(p.m, theme) : undefined};
      margin-top: ${isString(p.mt) ? getSpacing(p.mt, theme) : undefined};
      margin-bottom: ${isString(p.mb) ? getSpacing(p.mb, theme) : undefined};
      margin-left: ${isString(p.ml) ? getSpacing(p.ml, theme) : undefined};
      margin-right: ${isString(p.mr) ? getSpacing(p.mr, theme) : undefined};
    }
  `;
}

type FlexProps<T extends ContainerElement = 'div'> = Omit<
  ContainerProps<T>,
  'display'
> & {
  align?: Responsive<'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch'>;
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  flex?: Responsive<CSSProperties['flex']>;
  gap?: Responsive<SpacingSize | `${SpacingSize} ${SpacingSize}`>;
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: Responsive<boolean>;
  justify?: Responsive<
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
  >;
  wrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
};

const omitFlexProps = new Set<keyof FlexProps>([
  'as',
  'direction',
  'flex',
  'gap',
  'inline',
  'justify',
  'wrap',
]);

export const Flex = styled(
  <T extends ContainerElement = 'div'>(props: FlexProps<T>) => {
    const Component = props.as ?? 'div';
    return <Component {...(props as any)}>{props.children}</Component>;
  },
  {
    shouldForwardProp: prop => {
      if (
        omitFlexProps.has(prop as unknown as keyof FlexProps) ||
        omitContainerProps.has(prop as unknown as keyof ContainerProps<any>)
      ) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)<FlexProps<any>>`
  display: ${p => (p.as === 'span' || p.inline ? 'inline-flex' : 'flex')};
  flex-direction: ${p => (isString(p.direction) ? p.direction : undefined)};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => (isString(p.gap) ? getSpacing(p.gap, p.theme) : undefined)};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};

  ${p => flexBreakpointCSS(p.theme, p, {current: 'xs', previous: 'sm'})}
  ${p => flexBreakpointCSS(p.theme, p, {current: 'sm', previous: 'md'})}
  ${p => flexBreakpointCSS(p.theme, p, {current: 'md', previous: 'lg'})}
  ${p => flexBreakpointCSS(p.theme, p, {current: 'lg', previous: 'xl'})}
  ${p => flexBreakpointCSS(p.theme, p, {current: 'xl'})} /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: FlexProps<T>
) => React.ReactElement;

function flexBreakpointCSS(
  theme: Theme,
  p: FlexProps,
  {current, previous}: {current: Breakpoint; previous?: Breakpoint}
) {
  const mediaQuery = previous
    ? `(max-width: ${theme.breakpoints[previous]}) and(min-width: ${theme.breakpoints[current]})`
    : `(min-width: ${theme.breakpoints[current]})`;

  return css`
    @media ${mediaQuery} {
      display: ${isBreakpointProp(p.inline)
        ? p.inline[current]
          ? 'inline-flex'
          : 'flex'
        : undefined};

      flex-direction: ${isBreakpointProp(p.direction) ? p.direction[current] : undefined};
      justify-content: ${isBreakpointProp(p.justify) ? p.justify[current] : undefined};
      align-items: ${isBreakpointProp(p.align) ? p.align[current] : undefined};

      gap: ${isBreakpointProp(p.gap) ? p.gap[current] : undefined};

      flex-wrap: ${isBreakpointProp(p.wrap) ? p.wrap[current] : undefined};
      flex: ${isBreakpointProp(p.flex) ? p.flex[current] : undefined};
    }
  `;
}

function resolveRadius(sizeComponent: Radius | undefined, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }
  if (sizeComponent === '0') {
    return '0px';
  }
  return isChonkTheme(theme)
    ? theme.radius[sizeComponent as keyof typeof theme.radius]
    : theme.borderRadius;
}

function resolveSpacing(sizeComponent: SpacingSize, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }
  if (sizeComponent === '0') {
    return theme.space.none;
  }

  return theme.space[sizeComponent] ?? theme.space.none;
}

function isString(prop: unknown): prop is string {
  return typeof prop === 'string';
}

function isBreakpointProp<T>(prop: unknown): prop is Record<Breakpoint, T> {
  return typeof prop === 'object' && prop !== null;
}

// @TODO(jonasbadalic): do we need to cache this?
function getRadius(radius: Radius | undefined, theme: Theme) {
  if (!radius) {
    return undefined;
  }

  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

// @TODO(jonasbadalic): do we need to cache this?
function getSpacing(spacing: Spacing | undefined, theme: Theme): string | undefined {
  if (!spacing) {
    return undefined;
  }
  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}

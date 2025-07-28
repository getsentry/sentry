import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {
  css,
  type DO_NOT_USE_ChonkTheme,
  type SerializedStyles,
  type Theme,
} from '@emotion/react';
import styled from '@emotion/styled';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

const BREAKPOINT_ORDER: readonly Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

// We alias None -> 0 to make it slighly more terse and easier to read.
type RadiusSize = keyof DO_NOT_USE_ChonkTheme['radius'];
type SpacingSize = keyof Theme['space'];
type Breakpoint = keyof Theme['breakpoints'];

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
type Shorthand<T extends string, N extends 4 | 2> = N extends 4
  ? `${T} ${T} ${T} ${T}` | `${T} ${T} ${T}` | `${T} ${T}` | `${T}`
  : N extends 2
    ? `${T} ${T}` | `${T}`
    : never;

type Responsive<T> = T | Record<Breakpoint, T | undefined>;

/**
 * Our layout components use string sizes that map to t-shirt sizes, so we need
 * resolvers to transform them into actual CSS values.
 * The task is to take a string like "md sm" and lookup its theme value so that
 * it can become something like "16px 8px". Separate resolvers are needed for
 * handling the different themes and the implementation of chonk vs non chonk.
 */
function resolveRadius(sizeComponent: RadiusSize | undefined, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }

  return isChonkTheme(theme) ? theme.radius[sizeComponent] : theme.borderRadius;
}

function resolveSpacing(sizeComponent: SpacingSize, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }

  return theme.space[sizeComponent] ?? theme.space['0'];
}

function isResponsive(prop: unknown): prop is Record<Breakpoint, any> {
  return typeof prop === 'object' && prop !== null;
}

function getRadius(
  radius: Shorthand<RadiusSize, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
) {
  if (radius.length <= 3) {
    // This can only be a single radius value, so we can resolve it directly.
    return resolveRadius(radius as RadiusSize, theme) as string;
  }

  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

function getSpacing(
  spacing: Shorthand<SpacingSize, 4>,
  _breakpoint: Breakpoint | undefined,
  theme: Theme
): string {
  if (spacing.length <= 3) {
    // This can only be a single spacing value, so we can resolve it directly.
    return resolveSpacing(spacing as SpacingSize, theme) as string;
  }

  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}

/* eslint-disable typescript-sort-keys/interface */
interface BaseContainerProps {
  children?: React.ReactNode;
  background?: Responsive<keyof Theme['tokens']['background']>;
  display?: Responsive<
    'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid'
  >;

  padding?: Responsive<Shorthand<SpacingSize, 4>>;

  position?: Responsive<'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'>;

  overflow?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowX?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;
  overflowY?: Responsive<'visible' | 'hidden' | 'scroll' | 'auto'>;

  radius?: Responsive<Shorthand<RadiusSize, 4>>;

  width?: Responsive<CSSProperties['width']>;
  minWidth?: Responsive<CSSProperties['minWidth']>;
  maxWidth?: Responsive<CSSProperties['maxWidth']>;

  height?: Responsive<CSSProperties['height']>;
  minHeight?: Responsive<CSSProperties['minHeight']>;
  maxHeight?: Responsive<CSSProperties['maxHeight']>;

  area?: Responsive<CSSProperties['gridArea']>;
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
  'area',
  'background',
  'display',
  'padding',
  'overflow',
  'overflowX',
  'overflowY',
  'position',
  'radius',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
]);

export const Container = styled(
  <T extends ContainerElement = 'div'>({as, ...rest}: ContainerProps<T>) => {
    const Component = (as ?? 'div') as T;
    return <Component {...(rest as any)} />;
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
  ${p => rc('display', p.display, p.theme)};
  ${p => rc('position', p.position, p.theme)};

  ${p => rc('overflow', p.overflow, p.theme)};
  ${p => rc('overflow-x', p.overflowX, p.theme)};
  ${p => rc('overflow-y', p.overflowY, p.theme)};

  ${p => rc('padding', p.padding, p.theme, getSpacing)};

  ${p => rc('background', p.background, p.theme, v => p.theme.tokens.background[v])};

  ${p => rc('border-radius', p.radius, p.theme, getRadius)};

  ${p => rc('width', p.width, p.theme)};
  ${p => rc('min-width', p.minWidth, p.theme)};
  ${p => rc('max-width', p.maxWidth, p.theme)};

  ${p => rc('height', p.height, p.theme)};
  ${p => rc('min-height', p.minHeight, p.theme)};
  ${p => rc('max-height', p.maxHeight, p.theme)};

  ${p => rc('grid-area', p.area, p.theme)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T>
) => React.ReactElement;

// It is unfortunate, but Emotion seems to use the fn callback name in the classname, so lets keep it short.
function rc<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  // Optional resolver function to transform the value before it is applied to the CSS property.
  resolver?: (
    value: T,
    breakpoint: Breakpoint | undefined,
    theme: Theme
  ) => string | number
): SerializedStyles | undefined {
  if (!value) {
    return undefined;
  }

  // Most values are unlikely to be responsive, so we can resolve
  // them directly and return early.
  if (!isResponsive(value)) {
    return css`
      ${property}: ${resolver ? resolver(value, undefined, theme) : value};
    `;
  }

  let first = true;

  return css`
    ${BREAKPOINT_ORDER.map(breakpoint => {
      const v = value[breakpoint];
      if (v === undefined) {
        return undefined;
      }

      if (first) {
        first = false;
        return css`
          @media (min-width: ${theme.breakpoints[breakpoint]}),
            (max-width: ${theme.breakpoints[breakpoint]}) {
            ${property}: ${resolver ? resolver(v, breakpoint, theme) : (v as string)};
          }
        `;
      }

      return css`
        @media (min-width: ${theme.breakpoints[breakpoint]}) {
          ${property}: ${resolver ? resolver(v, breakpoint, theme) : (v as string)};
        }
      `;
    }).filter(Boolean)}
  `;
}

const omitFlexProps = new Set<keyof FlexProps>([
  'as',
  'direction',
  'flex',
  'gap',
  'inline',
  'align',
  'justify',
  'wrap',
  'order',
]);

type FlexProps<T extends ContainerElement = 'div'> = Omit<
  ContainerProps<T>,
  'display'
> & {
  /**
   * Aligns flex items along the cross axis of the current line of flex items.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  flex?: Responsive<CSSProperties['flex']>;
  gap?: Responsive<SpacingSize | `${SpacingSize} ${SpacingSize}`>;
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: Responsive<boolean>;
  /**
   * Aligns flex items along the block axis of the current line of flex items.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'>;
  order?: Responsive<CSSProperties['order']>;
  wrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
};

export const Flex = styled(
  <T extends ContainerElement = 'div'>({as, ...rest}: FlexProps<T>) => {
    const Component = (as ?? 'div') as T;
    return <Container as={Component} {...(rest as any)} />;
  },
  {
    shouldForwardProp: prop => {
      return !omitFlexProps.has(prop as unknown as keyof FlexProps);
    },
  }
)<FlexProps<any>>`
  ${p => rc('display', p.as === 'span' || p.inline ? 'inline-flex' : 'flex', p.theme)};

  ${p => rc('order', p.order, p.theme)};
  ${p => rc('gap', p.gap, p.theme, getSpacing)};

  ${p => rc('flex-direction', p.direction, p.theme)};
  ${p => rc('flex-wrap', p.wrap, p.theme)};
  ${p => rc('flex', p.flex, p.theme)};
  ${p =>
    rc('justify-content', p.justify, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'flex-start';
        case 'end':
          return 'flex-end';
        case 'center':
          return 'center';
        case 'between':
          return 'space-between';
        case 'around':
          return 'space-around';
        case 'evenly':
          return 'space-evenly';
        default:
          return value;
      }
    })};

  ${p =>
    rc('align-items', p.align, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'flex-start';
        case 'end':
          return 'flex-end';
        default:
          return value;
      }
    })};
  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: FlexProps<T>
) => React.ReactElement;

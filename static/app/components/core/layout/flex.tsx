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

  // Height
  height?: Responsive<CSSProperties['height']>;
  minHeight?: Responsive<CSSProperties['minHeight']>;
  maxHeight?: Responsive<CSSProperties['maxHeight']>;
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
  'height',
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
  'position',
  'radius',
  'width',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
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
  ${p => responsiveCSS('display', p.display, p.theme, v => v)};
  ${p => responsiveCSS('position', p.position, p.theme, v => v)};

  ${p => responsiveCSS('overflow', p.overflow, p.theme, v => v)};
  ${p => responsiveCSS('overflow-x', p.overflowX, p.theme, v => v)};
  ${p => responsiveCSS('overflow-y', p.overflowY, p.theme, v => v)};

  ${p =>
    responsiveCSS(
      'background',
      p.background,
      p.theme,
      v => p.theme.tokens.background[v]
    )};

  ${p => responsiveCSS('border-radius', p.radius, p.theme, getRadius)};

  ${p => responsiveCSS('padding', p.p, p.theme, getSpacing)};
  ${p => responsiveCSS('padding-top', p.pt, p.theme, getSpacing)};
  ${p => responsiveCSS('padding-bottom', p.pb, p.theme, getSpacing)};
  ${p => responsiveCSS('padding-left', p.pl, p.theme, getSpacing)};
  ${p => responsiveCSS('padding-right', p.pr, p.theme, getSpacing)};

  ${p => responsiveCSS('margin', p.m, p.theme, getSpacing)};
  ${p => responsiveCSS('margin-top', p.mt, p.theme, getSpacing)};
  ${p => responsiveCSS('margin-bottom', p.mb, p.theme, getSpacing)};
  ${p => responsiveCSS('margin-left', p.ml, p.theme, getSpacing)};
  ${p => responsiveCSS('margin-right', p.mr, p.theme, getSpacing)};

  ${p => responsiveCSS('width', p.width, p.theme, v => v)};
  ${p => responsiveCSS('min-width', p.minWidth, p.theme, v => v)};
  ${p => responsiveCSS('max-width', p.maxWidth, p.theme, v => v)};

  ${p => responsiveCSS('height', p.height, p.theme, v => v)};
  ${p => responsiveCSS('min-height', p.minHeight, p.theme, v => v)};
  ${p => responsiveCSS('max-height', p.maxHeight, p.theme, v => v)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T>
) => React.ReactElement;

function responsiveCSS<T>(
  property: string,
  value: Responsive<T> | undefined,
  theme: Theme,
  resolver: (value: T, theme: Theme) => string | number
): SerializedStyles | undefined {
  if (!value) {
    return undefined;
  }

  if (!isResponsive(value)) {
    return css`
      ${property}: ${resolver(value, theme)};
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
            ${property}: ${resolver(v, theme)};
          }
        `;
      }

      return css`
        @media (min-width: ${theme.breakpoints[breakpoint]}) {
          ${property}: ${resolver(v, theme)};
        }
      `;
    }).filter(Boolean)}
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
  ${p =>
    responsiveCSS(
      'display',
      p.as === 'span' || p.inline ? 'inline-flex' : 'flex',
      p.theme,
      v => v
    )};
  ${p => responsiveCSS('flex-direction', p.direction, p.theme, v => v)};
  ${p => responsiveCSS('justify-content', p.justify, p.theme, v => v)};
  ${p => responsiveCSS('align-items', p.align, p.theme, v => v)};
  ${p => responsiveCSS('gap', p.gap, p.theme, getSpacing)};
  ${p => responsiveCSS('flex-wrap', p.wrap, p.theme, v => v)};
  ${p => responsiveCSS('flex', p.flex, p.theme, v => v)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: FlexProps<T>
) => React.ReactElement;

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

function isResponsive(prop: unknown): prop is Record<Breakpoint, any> {
  return typeof prop === 'object' && prop !== null;
}

function getRadius(radius: Radius, theme: Theme) {
  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

function getSpacing(spacing: Spacing, theme: Theme): string {
  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}

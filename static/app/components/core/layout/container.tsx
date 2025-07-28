import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type {Theme} from 'sentry/utils/theme';

import {
  type Border,
  getBorder,
  getRadius,
  getSpacing,
  type RadiusSize,
  rc,
  type Responsive,
  type Shorthand,
  type SpacingSize,
} from './styles';

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

  width?: Responsive<React.CSSProperties['width']>;
  minWidth?: Responsive<React.CSSProperties['minWidth']>;
  maxWidth?: Responsive<React.CSSProperties['maxWidth']>;

  height?: Responsive<React.CSSProperties['height']>;
  minHeight?: Responsive<React.CSSProperties['minHeight']>;
  maxHeight?: Responsive<React.CSSProperties['maxHeight']>;

  border?: Responsive<Border>;

  area?: Responsive<React.CSSProperties['gridArea']>;
}
/* eslint-enable typescript-sort-keys/interface */
export type ContainerElement =
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

export type ContainerProps<T extends ContainerElement = 'div'> = BaseContainerProps & {
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

  ${p => rc('border', p.border, p.theme, getBorder)};

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: ContainerProps<T>
) => React.ReactElement;

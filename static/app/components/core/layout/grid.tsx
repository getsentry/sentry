import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {Container, type ContainerElement, type ContainerProps} from './container';
import {getSpacing, rc, type Responsive, type SpacingSize} from './styles';

const omitGridProps = new Set<keyof GridProps>([
  'align',
  'as',
  'autoColumns',
  'autoRows',
  'flow',
  'gap',
  'inline',
  'justify',
  'areas',
  'columns',
  'rows',
]);

type GridProps<T extends ContainerElement = 'div'> = Omit<
  ContainerProps<T>,
  'display'
> & {
  /**
   * Aligns grid items along the column axis within their grid cells.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  /**
   * Aligns grid items along the column axis within their grid cells.
   * Uses CSS align-content property.
   */
  alignContent?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'stretch'
  >;
  /**
   * Defines named grid areas for child components to reference.
   * Uses CSS grid-template-areas property.
   */
  areas?: Responsive<CSSProperties['gridTemplateAreas']>;
  /**
   * Specifies the size of auto-generated column tracks.
   * Uses CSS grid-auto-columns property.
   */
  autoColumns?: Responsive<CSSProperties['gridAutoColumns']>;
  /**
   * Specifies the size of auto-generated row tracks.
   * Uses CSS grid-auto-rows property.
   */
  autoRows?: Responsive<CSSProperties['gridAutoRows']>;
  /**
   * Defines the column tracks of the grid.
   * Uses CSS grid-template-columns property.
   */
  columns?: Responsive<CSSProperties['gridTemplateColumns']>;
  /**
   * Controls the auto-placement algorithm for grid items.
   * Uses CSS grid-auto-flow property.
   */
  flow?: Responsive<'row' | 'column' | 'row dense' | 'column dense'>;
  gap?: Responsive<SpacingSize | `${SpacingSize} ${SpacingSize}`>;
  /**
   * Determines whether the grid container should be displayed as an inline-grid.
   */
  inline?: Responsive<boolean>;
  /**
   * Aligns the grid container's content along the row axis when the grid is smaller than its container.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'stretch'
  >;
  /**
   * Aligns grid items along the row axis within their grid cells.
   * Uses CSS justify-items property.
   */
  justifyItems?: Responsive<'start' | 'end' | 'center' | 'stretch'>;
  /**
   * Defines the row tracks of the grid.
   * Uses CSS grid-template-rows property.
   */
  rows?: Responsive<CSSProperties['gridTemplateRows']>;
};

export const Grid = styled(
  <T extends ContainerElement = 'div'>({as, ...rest}: GridProps<T>) => {
    const Component = (as ?? 'div') as T;
    return <Container as={Component} {...(rest as any)} />;
  },
  {
    shouldForwardProp: prop => {
      return !omitGridProps.has(prop as unknown as keyof GridProps);
    },
  }
)<GridProps<any>>`
  ${p => rc('display', p.as === 'span' || p.inline ? 'inline-grid' : 'grid', p.theme)};

  ${p => rc('gap', p.gap, p.theme, getSpacing)};

  ${p => rc('grid-template-columns', p.columns, p.theme)};
  ${p => rc('grid-template-rows', p.rows, p.theme)};
  ${p => rc('grid-template-areas', p.areas, p.theme)};
  ${p => rc('grid-auto-columns', p.autoColumns, p.theme)};
  ${p => rc('grid-auto-rows', p.autoRows, p.theme)};
  ${p => rc('grid-auto-flow', p.flow, p.theme)};

  ${p =>
    rc('justify-content', p.justify, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'start';
        case 'end':
          return 'end';
        case 'center':
          return 'center';
        case 'between':
          return 'space-between';
        case 'around':
          return 'space-around';
        case 'evenly':
          return 'space-evenly';
        case 'stretch':
          return 'stretch';
        default:
          return value;
      }
    })};

  ${p =>
    rc('align-content', p.alignContent, p.theme, (value, _breakpoint, _theme) => {
      switch (value) {
        case 'start':
          return 'start';
        case 'end':
          return 'end';
        case 'center':
          return 'center';
        case 'between':
          return 'space-between';
        case 'around':
          return 'space-around';
        case 'evenly':
          return 'space-evenly';
        case 'stretch':
          return 'stretch';
        default:
          return value;
      }
    })};

  ${p => rc('align-items', p.align, p.theme)};
  ${p => rc('justify-items', p.justifyItems, p.theme)};
  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends ContainerElement = 'div'>(
  props: GridProps<T>
) => React.ReactElement;

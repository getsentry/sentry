const alignment: Record<string, string | undefined> = {
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};
import type {CSS} from '@sentry/scraps/cssTypes';
import type {SpaceSize} from '@sentry/scraps/theme';

import {
  addContainerStyles,
  LayoutElement,
  omitContainerProps,
  type ContainerElement,
  type ContainerProps,
  type ContainerPropsWithRenderFunction,
} from './container';
import {getSpacing, type Responsive} from './styles';
import {addLayoutProp, useLayoutStyle} from './yakLayout';

const omitGridProps = new Set<keyof GridLayoutProps | 'as'>([
  'align',
  'alignContent',
  'as',
  'autoColumns',
  'autoRows',
  'flow',
  'gap',
  'display',
  'justify',
  'justifyItems',
  'areas',
  'columns',
  'rows',
]);

interface GridLayoutProps {
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
  areas?: Responsive<CSS['gridTemplateAreas']>;
  /**
   * Specifies the size of auto-generated column tracks.
   * Uses CSS grid-auto-columns property.
   */
  autoColumns?: Responsive<CSS['gridAutoColumns']>;
  /**
   * Specifies the size of auto-generated row tracks.
   * Uses CSS grid-auto-rows property.
   */
  autoRows?: Responsive<CSS['gridAutoRows']>;
  /**
   * Defines the column tracks of the grid.
   * Uses CSS grid-template-columns property.
   */
  columns?: Responsive<CSS['gridTemplateColumns']>;
  /**
   * Determines the grid display type.
   */
  display?: Responsive<'grid' | 'inline-grid' | 'none'>;
  /**
   * Controls the auto-placement algorithm for grid items.
   * Uses CSS grid-auto-flow property.
   */
  flow?: Responsive<'row' | 'column' | 'row dense' | 'column dense'>;
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
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
  rows?: Responsive<CSS['gridTemplateRows']>;
}

export type GridProps<T extends ContainerElement = 'div'> = ContainerProps<T> &
  GridLayoutProps;

export type GridPropsWithRenderFunction<T extends ContainerElement = 'div'> =
  ContainerPropsWithRenderFunction<T> & GridLayoutProps;

const omitted = new Set<string>([...omitContainerProps, ...omitGridProps]);
export function Grid<T extends ContainerElement = 'div'>(
  props: GridProps<T> | GridPropsWithRenderFunction<T>
) {
  const acc = useLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props, props.display ?? 'grid');
  addLayoutProp(acc, 'gap', props.gap, (v, theme) => getSpacing(v, undefined, theme));
  addLayoutProp(acc, 'gridTemplateColumns', props.columns);
  addLayoutProp(acc, 'gridTemplateRows', props.rows);
  addLayoutProp(acc, 'gridTemplateAreas', props.areas);
  addLayoutProp(acc, 'gridAutoColumns', props.autoColumns);
  addLayoutProp(acc, 'gridAutoRows', props.autoRows);
  addLayoutProp(acc, 'gridAutoFlow', props.flow);
  addLayoutProp(acc, 'justifyContent', props.justify, v => alignment[v] ?? v);
  addLayoutProp(acc, 'alignContent', props.alignContent, v => alignment[v] ?? v);
  addLayoutProp(acc, 'alignItems', props.align);
  addLayoutProp(acc, 'justifyItems', props.justifyItems);
  return <LayoutElement elementProps={props} layoutStyle={acc} omitProps={omitted} />;
}

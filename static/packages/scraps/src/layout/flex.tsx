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
import {
  FLEX_JUSTIFY_CONTENT,
  type FlexJustify,
  getSpacing,
  type Responsive,
} from './styles';
import {addLayoutProp, useLayoutStyle} from './yakLayout';

const omitFlexProps = new Set<keyof FlexLayoutProps | 'as'>([
  'as',
  'direction',
  'flex',
  'gap',
  'display',
  'align',
  'justify',
  'wrap',
]);

interface FlexLayoutProps {
  /**
   * Aligns flex items along the cross axis of the current line of flex items.
   * Uses CSS align-items property.
   */
  align?: Responsive<'start' | 'end' | 'center' | 'baseline' | 'stretch'>;
  /**
   * Specifies the direction of the flex items.
   */
  direction?: Responsive<'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  /**
   * Specifies the display type of the flex container.
   */
  display?: Responsive<'flex' | 'inline-flex' | 'none'>;
  /**
   * Shorthand for the flex property.
   */
  flex?: Responsive<CSS['flex']>;
  /**
   * Specifies the spacing between flex items.
   */
  gap?: Responsive<SpaceSize | `${SpaceSize} ${SpaceSize}`>;
  /**
   * Aligns flex items along the block axis of the current line of flex items.
   * Uses CSS justify-content property.
   */
  justify?: Responsive<FlexJustify>;
  /**
   * Specifies the wrapping behavior of the flex items.
   */
  wrap?: Responsive<'nowrap' | 'wrap' | 'wrap-reverse'>;
}

export interface FlexProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerProps<T>, 'display'>, FlexLayoutProps {}
export interface FlexPropsWithRenderFunction<T extends ContainerElement = 'div'>
  extends Omit<ContainerPropsWithRenderFunction<T>, 'display'>, FlexLayoutProps {}

const omitted = new Set<string>([...omitContainerProps, ...omitFlexProps]);
export function Flex<T extends ContainerElement = 'div'>(
  props: FlexProps<T> | FlexPropsWithRenderFunction<T>
) {
  const acc = useLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props, props.display ?? 'flex');
  addLayoutProp(acc, 'gap', props.gap, (v, theme) => getSpacing(v, undefined, theme));
  addLayoutProp(acc, 'flexDirection', props.direction);
  addLayoutProp(acc, 'flexWrap', props.wrap);
  addLayoutProp(acc, 'justifyContent', props.justify, v => FLEX_JUSTIFY_CONTENT[v]);
  addLayoutProp(acc, 'alignItems', props.align, v =>
    v === 'start' ? 'flex-start' : v === 'end' ? 'flex-end' : v
  );
  return <LayoutElement elementProps={props} layoutStyle={acc} omitProps={omitted} />;
}

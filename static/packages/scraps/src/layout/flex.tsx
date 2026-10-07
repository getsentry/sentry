import type {CSS} from '@sentry/scraps/cssTypes';
import type {SpaceSize} from '@sentry/scraps/theme';

import {
  addContainerStyles,
  omitContainerProps,
  resolveSpacing,
  useLayoutElement,
  type ContainerElement,
  type ContainerProps,
  type ContainerPropsWithRenderFunction,
} from './container';
import {FLEX_JUSTIFY_CONTENT, type FlexJustify, type Responsive} from './styles';
import {addLayoutProp, createLayoutStyle} from './stylexLayout';

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

const OMIT_FLEX_PROPS: ReadonlySet<string> = new Set<string>([
  ...omitContainerProps,
  ...omitFlexProps,
]);

function resolveFlexAlign(value: NonNullable<FlexLayoutProps['align']> & string) {
  switch (value) {
    case 'start':
      return 'flex-start';
    case 'end':
      return 'flex-end';
    default:
      return value;
  }
}

function FlexComponent<T extends ContainerElement = 'div'>(
  props: FlexProps<T> | FlexPropsWithRenderFunction<T>
) {
  const acc = createLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props, props.display ?? 'flex');
  addLayoutProp(acc, 'gap', props.gap, {fixed: 'gap', resolve: resolveSpacing});
  addLayoutProp(acc, 'flexDirection', props.direction, {fixed: 'direction'});
  addLayoutProp(acc, 'flexWrap', props.wrap, {fixed: 'wrap'});
  addLayoutProp(acc, 'justifyContent', props.justify, {
    fixed: 'flexJustify',
    resolve: value => FLEX_JUSTIFY_CONTENT[value],
  });
  addLayoutProp(acc, 'alignItems', props.align, {
    fixed: 'flexAlign',
    resolve: resolveFlexAlign,
  });
  return useLayoutElement(props, acc, OMIT_FLEX_PROPS);
}

export const Flex = FlexComponent as <T extends ContainerElement = 'div'>(
  props: FlexProps<T> | FlexPropsWithRenderFunction<T>
) => React.ReactElement;

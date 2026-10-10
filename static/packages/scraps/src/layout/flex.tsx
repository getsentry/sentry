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
import {addLayoutProp, createLayoutStyle} from './linariaLayout';
import {FLEX_JUSTIFY_CONTENT, type FlexJustify, type Responsive} from './styles';

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

const GAP_OPTIONS = {fixed: 'gap', resolve: resolveSpacing};
const DIRECTION_OPTIONS = {fixed: 'direction'};
const WRAP_OPTIONS = {fixed: 'wrap'};
const JUSTIFY_OPTIONS = {
  fixed: 'flexJustify',
  resolve: (value: FlexJustify) => FLEX_JUSTIFY_CONTENT[value],
};
const ALIGN_OPTIONS = {fixed: 'flexAlign', resolve: resolveFlexAlign};

function FlexComponent<T extends ContainerElement = 'div'>(
  props: FlexProps<T> | FlexPropsWithRenderFunction<T>
) {
  const acc = createLayoutStyle(typeof props.children === 'function');
  addContainerStyles(acc, props, props.display ?? 'flex');
  addLayoutProp(acc, 'gap', props.gap, GAP_OPTIONS);
  addLayoutProp(acc, 'flexDirection', props.direction, DIRECTION_OPTIONS);
  addLayoutProp(acc, 'flexWrap', props.wrap, WRAP_OPTIONS);
  addLayoutProp(acc, 'justifyContent', props.justify, JUSTIFY_OPTIONS);
  addLayoutProp(acc, 'alignItems', props.align, ALIGN_OPTIONS);
  return useLayoutElement(props, acc, OMIT_FLEX_PROPS);
}

export const Flex = FlexComponent as <T extends ContainerElement = 'div'>(
  props: FlexProps<T> | FlexPropsWithRenderFunction<T>
) => React.ReactElement;

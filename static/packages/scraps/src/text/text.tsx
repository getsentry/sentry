import {useLayoutElement} from '@sentry/scraps/layout/container';
import {
  addLayoutProp,
  addStyles,
  createLayoutStyle,
  type LayoutStyle,
} from '@sentry/scraps/layout/linariaLayout';
import type {Responsive} from '@sentry/scraps/layout/styles';
import type {ContentVariant, TextSize, Theme} from '@sentry/scraps/theme';

import {
  addCommonTextStyles,
  addDensity,
  addFontSize,
  getFontWeightStyle,
  TEXT_STYLE_PROPS,
} from './linariaStyles';

export interface BaseTextProps {
  /**
   * Horizontal alignment of the text.
   *
   */
  align?: Responsive<'left' | 'center' | 'right' | 'justify'>;
  bold?: boolean;

  /**
   * Determines the cursor style when hovering over the text.
   * @default 'default'
   */
  cursor?: 'default' | 'pointer' | 'text' | 'move' | 'not-allowed' | 'wait' | 'help';

  /**
   * Density determines the line height of the text.
   * Defaults to 1.2, but supports the following density variants:
   * - compressed: 1
   * - default: 1.2
   * - comfortable: 1.4
   * - fixed: 1rem
   */
  density?: Responsive<keyof Theme['font']['lineHeight']>;
  /**
   * If true, the text will be truncated with an ellipsis,
   * overflow will be hidden and white-space will be set to nowrap.
   * @default false
   */
  ellipsis?: boolean;
  /**
   * Determines if fractional numbers should be displayed using diagonal fractions.
   * @default false
   */
  fraction?: boolean;

  /**
   * Determines if the text should be italic.
   * @default false
   */
  italic?: boolean;

  /**
   * If true, the text will be displayed in a monospace font.
   */
  monospace?: boolean;

  /**
   * Strikethrough the text.
   * @default false
   */
  strikethrough?: boolean;

  /**
   * If true, the text will be displayed in a tabular font (fixed width numbers)
   */
  tabular?: boolean;

  /**
   * Determines how text wrapping is handled using the CSS text-wrap property.
   * @default undefined
   */
  textWrap?: 'wrap' | 'nowrap' | 'balance' | 'pretty' | 'stable';

  /**
   * Determines how text should be underlined.
   * @default undefined
   */
  underline?: boolean | 'dotted';

  /**
   * Uppercase the text.
   */
  uppercase?: boolean;

  /**
   * Variant determines the style of the text.
   * - Use a semantic variant (e.g. `primary`, `muted`) to apply a token-based color.
   * - Use `inherit` to explicitly inherit the color from the parent element.
   * @default primary
   */
  variant?: ContentVariant | 'muted' | 'inherit';

  /**
   * Determines where line breaks appear when wrapping the text.
   * @default undefined
   */
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';

  /**
   * Determines text wrapping.
   */
  wrap?: 'nowrap' | 'normal' | 'pre' | 'pre-line' | 'pre-wrap';
}

type ExclusiveTextEllipsisProps =
  | {
      // ellipsis always needs a block-level box to truncate
      display?: never;
      ellipsis?: true;
      wrap?: never;
    }
  | {
      display?: Responsive<DisplayValue>;
      ellipsis?: never;
      wrap?: BaseTextProps['wrap'];
    };

interface TextAttributes<T extends TextPrimitive = 'span'>
  extends
    BaseTextProps,
    Omit<
      React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElementTagNameMap[T]>,
        HTMLElementTagNameMap[T]
      >,
      'style'
    > {
  /**
   * Our decision to make children required conflicts with the optional signature of the React.DetailedHTMLProps type.
   * To resolve it, we move the children definition after the React.DetailedHTMLProps type,
   * which narrows the type from optional to required as expected.
   */
  children: React.ReactNode;
  /**
   * The HTML element to render the text as - defaults to span.
   * @default span
   */
  as?: T;
  /**
   * Forbid color HTML attribute from being passed to the component, all usage should be variant-based.
   */
  color?: never;
  dateTime?: T extends 'time' ? string : never;

  /**
   * This could have been avoided by using React.JSX.IntrinsicElements<T>, however doing so would be
   * grosely inefficient, as it would cause type helpers like DistributedOmit to traverse the entire
   * type HTML Attribute set of each element, slowing down our type compilation. In my test, using
   * React.JSX.IntrinsicElements<T> caused native ts compilation to take 2x longer.
   *
   */
  htmlFor?: T extends 'label' ? string : never;
  /**
   * The size of the text.
   * @default md
   */
  size?: Responsive<TextSize>;

  /**
   * Deprecated in favor of the Text component API.
   * If you have an is an unsupported use-case, please contact design engineering for support.
   * @deprecated
   */
  style?: React.CSSProperties;
}

type TextPrimitive = 'span' | 'p' | 'label' | 'div' | 'time' | 'legend';

type DisplayValue = 'inline' | 'block' | 'inline-block' | 'none';

type TextStyleProps = BaseTextProps & {
  as?: TextPrimitive;
  display?: Responsive<DisplayValue>;
  size?: Responsive<TextSize>;
};

function getDefaultDisplay(p: {
  align?: BaseTextProps['align'];
  as?: TextPrimitive;
  ellipsis?: boolean;
}): DisplayValue | undefined {
  if (p.as === 'div') {
    return 'block';
  }
  if (p.ellipsis || p.align) {
    return p.as === 'span' ? 'inline-block' : 'block';
  }
  return undefined;
}

function getNativeDisplay(as: TextPrimitive | undefined): DisplayValue {
  return as === 'p' || as === 'div' || as === 'legend' ? 'block' : 'inline';
}

export type TextProps<T extends TextPrimitive> = TextAttributes<T> &
  ExclusiveTextEllipsisProps;

export type TextPropsWithRenderFunction<T extends TextPrimitive = 'span'> =
  BaseTextProps &
    ExclusiveTextEllipsisProps & {
      children: (props: {
        className: string;
        style?: React.CSSProperties;
      }) => React.ReactNode | undefined;
      as?: never;
      color?: never;
      dateTime?: never;
      htmlFor?: never;
      ref?: never;
      size?: Responsive<TextSize>;
    } & Partial<
      Record<
        // HTMLAttributes extends from DOMAttributes which types children as React.ReactNode | undefined.
        // Therefore, we need to exclude it from the map, or the children will produce a never type.
        Exclude<
          keyof React.DetailedHTMLProps<
            React.HTMLAttributes<HTMLElementTagNameMap[T]>,
            HTMLElementTagNameMap[T]
          >,
          'children'
        >,
        never
      >
    >;

const OMIT_TEXT_PROPS = TEXT_STYLE_PROPS;

/**
 * When no explicit `display` prop is set, the derived default is applied.
 */
function addTextDisplay(
  acc: LayoutStyle,
  p: Pick<TextStyleProps, 'align' | 'as' | 'display' | 'ellipsis'>
): void {
  const fallback = getDefaultDisplay(p);

  if (p.display === undefined || typeof p.display === 'string') {
    addLayoutProp(acc, 'display', p.display ?? fallback, {fixed: 'display'});
    return;
  }

  // For a responsive prop, seed the base (`zero`) slot when the consumer left it
  // unset (with the derived default, or the element's native display) so
  // unspecified small breakpoints keep a sensible default instead of the value
  // of the smallest specified breakpoint.
  const value =
    p.display.zero === undefined
      ? {zero: fallback ?? getNativeDisplay(p.as), ...p.display}
      : p.display;
  addLayoutProp(acc, 'display', value, {fixed: 'display'});
}

function TextComponent<T extends TextPrimitive = 'span'>(
  props: TextProps<T> | TextPropsWithRenderFunction<T>
) {
  const p = props as unknown as TextStyleProps;
  const acc = createLayoutStyle(typeof props.children === 'function');
  addFontSize(acc, p.size);
  addDensity(acc, p.density);
  addTextDisplay(acc, p);
  addCommonTextStyles(acc, p, {fullWidthEllipsis: true});
  if (p.bold !== undefined) {
    addStyles(acc, getFontWeightStyle(p.monospace, p.bold ? 'medium' : 'regular'));
  }
  return useLayoutElement(props, acc, OMIT_TEXT_PROPS, 'span');
}

export const Text = TextComponent as <T extends TextPrimitive = 'span'>(
  props: TextProps<T> | TextPropsWithRenderFunction<T>
) => React.ReactElement;

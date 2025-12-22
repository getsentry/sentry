import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {rc, type Responsive} from 'sentry/components/core/layout/styles';

import {getFontSize, getLineHeight, getTextDecoration} from './styles';

export interface BaseTextProps {
  children: React.ReactNode;
  /**
   * Horizontal alignment of the text.
   *
   */
  align?: Responsive<'left' | 'center' | 'right' | 'justify'>;
  bold?: boolean;
  /**
   * Density determines the line height of the text.
   * Defaults to 1.2, but supports the following density variants:
   * - compressed: 1
   * - comfortable: 1.4
   */
  density?: Responsive<'compressed' | 'comfortable'>;
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
   * The size of the text.
   * @default md
   */
  size?: Responsive<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'>;

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
   * @default primary
   */
  variant?: keyof Theme['tokens']['content'];

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

export type ExclusiveTextEllipsisProps =
  | {ellipsis?: true; wrap?: never}
  | {ellipsis?: never; wrap?: BaseTextProps['wrap']};

export type TextProps<T extends 'span' | 'p' | 'div'> = BaseTextProps & {
  /**
   * The HTML element to render the text as - defaults to span.
   * @default span
   */
  as?: T;
  ref?: React.Ref<HTMLElementTagNameMap[T] | null> | undefined;
} & Omit<React.HTMLAttributes<HTMLElementTagNameMap[T]>, 'color'> &
  ExclusiveTextEllipsisProps;

export const Text = styled(
  <T extends 'span' | 'p' | 'div' = 'span'>(
    props: TextProps<T> & ExclusiveTextEllipsisProps
  ) => {
    const {children, ...rest} = props;
    const Component = props.as || 'span';
    return <Component {...(rest as any)}>{children}</Component>;
  },
  {
    shouldForwardProp: p => isPropValid(p),
  }
)`
  ${p => rc('font-size', p.size, p.theme, v => getFontSize(v ?? 'md', p.theme))};
  ${p => rc('line-height', p.density, p.theme, v => getLineHeight(v))};
  ${p => rc('text-align', p.align, p.theme)};

  font-style: ${p => (p.italic ? 'italic' : undefined)};
  text-decoration: ${p => getTextDecoration(p)};

  color: ${p =>
    p.variant
      ? (p.theme.tokens.content[p.variant] ?? p.theme.tokens.content.primary)
      : p.theme.tokens.content.primary};

  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  text-wrap: ${p => p.textWrap ?? undefined};
  word-break: ${p => p.wordBreak ?? undefined};
  width: ${p => (p.ellipsis ? '100%' : undefined)};
  display: ${p =>
    p.as === 'div'
      ? 'block'
      : p.ellipsis || p.align
        ? p.as === 'span'
          ? 'inline-block'
          : 'block'
        : undefined};

  font-family: ${p => p.theme.font.family[p.monospace ? 'mono' : 'sans']};
  font-weight: ${p =>
    p.bold === true
      ? p.theme.font.weight[p.monospace ? 'mono' : 'sans'].medium
      : p.bold === false
        ? p.theme.font.weight[p.monospace ? 'mono' : 'sans'].regular
        : undefined};
  font-variant-numeric: ${p =>
    [
      p.tabular ? 'tabular-nums' : undefined,
      p.fraction ? 'diagonal-fractions' : undefined,
    ]
      .filter(Boolean)
      .join(' ')};
  text-transform: ${p => (p.uppercase ? 'uppercase' : undefined)};

  text-box-edge: text text;
  text-box-trim: trim-both;

  /**
   * Reset any margin or padding that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;

  /**
   * This cast is required because styled-components does not preserve the generic signature of the wrapped component.
   * By default, the generic type parameter <T> is lost, so we use 'as unknown as' to restore the correct typing.
   * https://github.com/styled-components/styled-components/issues/1803
   */
` as unknown as <T extends 'span' | 'p' | 'div'>(
  props: TextProps<T>
) => React.ReactElement;

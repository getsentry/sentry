import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {getFontSize, getLineHeight, getTextDecoration} from './styles';

export interface BaseTextProps {
  children: React.ReactNode;
  /**
   * Horizontal alignment of the text.
   *
   */
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  /**
   * Density determines the line height of the text.
   * Defaults to 1.2, but supports the following density variants:
   * - compressed: 1
   * - comfortable: 1.4
   */
  density?: 'compressed' | 'comfortable';
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
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

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
   * Determines if the text should be underlined.
   * @default false
   */
  underline?: boolean;

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
  font-size: ${p => getFontSize(p.size, p.theme)};
  font-style: ${p => (p.italic ? 'italic' : undefined)};

  line-height: ${p => getLineHeight(p.density)};
  text-decoration: ${p => getTextDecoration(p)};

  color: ${p =>
    p.variant
      ? (p.theme.tokens.content[p.variant] ?? p.theme.tokens.content.primary)
      : p.theme.tokens.content.primary};
  text-align: ${p => p.align ?? 'left'};

  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  width: ${p => (p.ellipsis ? '100%' : undefined)};
  display: ${p =>
    p.as === 'div'
      ? 'block'
      : p.ellipsis || p.align
        ? p.as === 'span'
          ? 'inline-block'
          : 'block'
        : undefined};

  font-family: ${p => (p.monospace ? p.theme.text.familyMono : p.theme.text.family)};
  font-weight: ${p => (p.bold ? p.theme.fontWeight.bold : undefined)};
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

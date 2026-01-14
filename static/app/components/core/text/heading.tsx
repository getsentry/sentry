import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {rc} from 'sentry/components/core/layout/styles';
import type {FontSize} from 'sentry/utils/theme';

import {getFontSize, getLineHeight, getTextDecoration} from './styles';
import {type BaseTextProps, type ExclusiveTextEllipsisProps} from './text';

type BaseHeadingProps = Omit<BaseTextProps, 'bold' | 'uppercase'>;

export type HeadingProps = BaseHeadingProps & {
  /**
   * The HTML element to render the title as.
   * @required
   */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  ref?: React.Ref<HTMLHeadingElement | null> | undefined;
  /**
   * Deprecated in favor of the Text component API.
   * If you have an is an unsupported use-case, please contact design engineering for support.
   * @deprecated
   */
  style?: React.CSSProperties;
} & Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>,
    'style'
  > &
  ExclusiveTextEllipsisProps;

export const Heading = styled(
  (props: HeadingProps) => {
    const {children, as, ...rest} = props;
    const HeadingComponent = as;

    return <HeadingComponent {...rest}>{children}</HeadingComponent>;
  },
  {
    shouldForwardProp: p => isPropValid(p),
  }
)`
  ${p =>
    rc('font-size', p.size ?? getDefaultHeadingFontSize(p.as), p.theme, v => {
      return getFontSize(v, p.theme);
    })};
  ${p => rc('line-height', p.density, p.theme, v => getLineHeight(v, p.theme))};
  ${p => rc('text-align', p.align, p.theme)};

  font-style: ${p => (p.italic ? 'italic' : undefined)};

  text-decoration: ${p => getTextDecoration(p)};

  color: ${p => p.theme.tokens.content[p.variant ?? 'primary']};

  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  text-wrap: ${p => p.textWrap ?? undefined};

  font-family: ${p => p.theme.font.family[p.monospace ? 'mono' : 'sans']};
  font-weight: ${p => p.theme.font.weight[p.monospace ? 'mono' : 'sans'].medium};
  font-variant-numeric: ${p =>
    [
      p.tabular ? 'tabular-nums' : undefined,
      p.fraction ? 'diagonal-fractions' : undefined,
    ]
      .filter(Boolean)
      .join(' ')};

  text-box-edge: text text;
  text-box-trim: trim-both;

  /**
   * Reset any margin or padding that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
`;

function getDefaultHeadingFontSize(as: HeadingProps['as']): FontSize {
  switch (as) {
    case 'h1':
      return '2xl';
    case 'h2':
      return 'xl';
    case 'h3':
      return 'lg';
    case 'h4':
      return 'md';
    case 'h5':
      return 'sm';
    case 'h6':
      return 'xs';
    default:
      return '2xl';
  }
}

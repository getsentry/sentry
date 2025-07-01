import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

interface TextProps {
  children: React.ReactNode;
  /**
   * Horizontal alignment of the text.
   *
   */
  align?: 'left' | 'center' | 'right' | 'justify';
  /**
   * The HTML element to render the text as.
   */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
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
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Strikethrough the text.
   * @default false
   */
  strikethrough?: boolean;

  /**
   * Determines if the text should be underlined.
   * @default false
   */
  underline?: boolean;

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

export const Text = styled((props: TextProps) => {
  const {children, ...rest} = props;
  return <span {...rest}>{children}</span>;
})`
  font-size: ${p => getFontSize(p.size, p.theme)};
  font-style: ${p => (p.italic ? 'italic' : undefined)};

  line-height: ${p => getLineHeight(p.density)};
  text-decoration: ${p => getTextDecoration(p)};

  color: ${p => p.theme.tokens.content[p.variant ?? 'primary']};
  text-align: ${p => p.align ?? 'left'};

  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  width: ${p => (p.ellipsis ? '100%' : undefined)};
  display: ${p => (p.ellipsis ? 'inline-block' : undefined)};

  font-family: ${p => (p.monospace ? p.theme.text.familyMono : p.theme.text.family)};
  font-weight: ${p => (p.bold ? p.theme.fontWeight.bold : undefined)};
`;

interface TitleProps extends TextProps {
  /**
   * The HTML element to render the title as.
   * @default h1
   */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const Title = styled((props: TitleProps) => {
  const {children, as, ...rest} = props;
  const TitleComponent = as || 'h1';

  return <TitleComponent {...rest}>{children}</TitleComponent>;
})`
  font-size: ${p => getFontSize(p.size ?? getDefaultTitleFontSize(p.as), p.theme)};
  font-style: ${p => (p.italic ? 'italic' : undefined)};

  line-height: ${p => getLineHeight(p.density)};
  text-decoration: ${p => getTextDecoration(p)};

  color: ${p => p.theme.tokens.content[p.variant ?? 'primary']};
  text-align: ${p => p.align ?? 'left'};

  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};

  font-family: ${p => (p.monospace ? p.theme.text.familyMono : p.theme.text.family)};
  font-weight: ${p => (p.bold ? p.theme.fontWeight.bold : undefined)};
`;

Object.assign(Text, {
  Title,
});

function getDefaultTitleFontSize(as: TitleProps['as']) {
  switch (as) {
    case 'h1':
      return 'xl';
    case 'h2':
      return 'lg';
    case 'h3':
      return 'md';
    case 'h4':
      return 'sm';
    case 'h5':
      return 'xs';
    case 'h6':
      return '2xs';
    default:
      return 'xl';
  }
}

function getTextDecoration(p: TextProps) {
  const decorations: string[] = [];
  if (p.strikethrough) {
    decorations.push('line-through');
  }
  if (p.underline) {
    decorations.push('underline');
  }
  return decorations.join(' ');
}

function getLineHeight(density: TextProps['density']) {
  switch (density) {
    case 'compressed':
      return '1';
    case 'comfortable':
      return '1.4';
    // @TODO: Fixed density is 16, how does that work with larger sizes?
    case undefined:
    default:
      return '1.2';
  }
}

function getFontSize(size: TextProps['size'], theme: Theme) {
  switch (size) {
    case '2xs':
      return theme.fontSize.xs;
    case 'xs':
      return theme.fontSize.sm;
    case 'sm':
      return theme.fontSize.md;
    case 'lg':
      return theme.fontSize.lg;
    case 'xl':
      return theme.fontSize.xl;
    default:
      return theme.fontSize.md;
  }
}

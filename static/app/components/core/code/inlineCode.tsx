import {css, useTheme, type Theme} from '@emotion/react';

export const inlineCodeStyles = (theme: Theme, props?: InlineCodeProps) => css`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;

  font-family: ${theme.font.family.mono};
  /**
   * adjust height of x character to 57% of bounding box
   * to match Rubik's x-height (magic number)
   */
  font-size-adjust: ex-height 0.57;

  color: ${props?.variant === 'neutral'
    ? theme.tokens.content.primary
    : theme.tokens.content.promotion};
  background: ${props?.variant === 'neutral'
    ? theme.tokens.background.transparent.neutral.muted
    : theme.tokens.background.transparent.promotion.muted};

  padding-inline: 0.3ch;
  margin-inline: -0.15ch;
  border-radius: ${theme.radius['2xs']};
  /* 3px (2xs) at 14px font-size and 8px (lg) at 24px font */
  border-radius: clamp(0.21em, 0.28em, 0.57em);

  text-box-edge: text text;
  text-box-trim: trim-both;
`;

interface InlineCodeProps extends React.HTMLProps<HTMLElementTagNameMap['code']> {
  variant?: 'neutral' | 'accent';
}
export function InlineCode(props: InlineCodeProps) {
  const theme = useTheme();
  const {variant: _, ...domProps} = props;
  return <code css={inlineCodeStyles(theme, props)} {...domProps} />;
}

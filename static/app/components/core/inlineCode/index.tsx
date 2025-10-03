import {css, useTheme, type Theme} from '@emotion/react';

export const inlineCodeStyles = (theme: Theme) => css`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;

  font-family: ${theme.text.familyMono};
  /**
   * adjust height of x character to 57% of bounding box
   * to match Rubik's x-height (magic number)
   */
  font-size-adjust: ex-height 0.57;

  color: ${theme.tokens.content.promotion};
  background: color-mix(in oklab, currentColor, transparent 92%);
  border-top: 1px solid transparent;
  border-image: radial-gradient(
      color-mix(in oklab, currentColor, transparent 50%),
      transparent
    )
    1;

  padding-inline: 0.3ch;
  margin-inline: -0.15ch;
  border-radius: 2px;

  text-box-edge: text text;
  text-box-trim: trim-both;
`;

interface InlineCodeProps extends React.HTMLProps<HTMLElementTagNameMap['code']> {}
export function InlineCode(props: InlineCodeProps) {
  const theme = useTheme();
  return <code css={inlineCodeStyles(theme)} {...props} />;
}

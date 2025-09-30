import styled from '@emotion/styled';

export const InlineCode = styled('code')`
  /**
   * Reset any properties that might be set by the global CSS styles.
   */
  margin: 0;
  padding: 0;
  border: none;

  font-family: ${p => p.theme.text.familyMono};
  /**
   * adjust height of x character to 57% of bounding box
   * to match Rubik (see )
   */
  font-size-adjust: ex-height 0.57;

  color: ${p => p.theme.tokens.content.promotion};
  background: color-mix(in srgb, currentColor, transparent 93%);

  padding-inline: 0.3ch;
  margin-inline: -0.1ch;
  border-radius: 2px;

  text-box-edge: text text;
  text-box-trim: trim-both;
`;

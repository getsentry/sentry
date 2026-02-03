import type {Theme} from '@emotion/react';
import {css, Global} from '@emotion/react';

const styles = (theme: Theme) => css`
  body {
    color: ${theme.tokens.content.primary};
    background: ${theme.tokens.background.secondary};
  }

  a {
    color: ${theme.tokens.interactive.link.accent.rest};
    &:hover {
      color: ${theme.tokens.interactive.link.accent.hover};
    }
  }

  .loading .loading-indicator {
    border-color: ${theme.tokens.background.transparent.neutral.muted};
    border-left-color: ${theme.tokens.graphics.accent.vibrant};
  }

  acronym,
  abbr {
    border-bottom: 1px dotted #ccc;
    text-decoration: none;
  }
`;

/**
 * Renders an emotion global styles injection component
 */
function GlobalStyles({theme}: {theme: Theme}) {
  return <Global styles={styles(theme)} />;
}

export default GlobalStyles;

import type {Theme} from '@emotion/react';
import {css, Global} from '@emotion/react';

const styles = (theme: Theme) => css`
  body {
    color: ${theme.tokens.content.primary};
    background: ${theme.backgroundSecondary};
  }

  a {
    color: ${theme.linkColor};
    &:hover {
      color: ${theme.linkHoverColor};
    }
  }

  .loading .loading-indicator {
    border-color: ${theme.backgroundSecondary};
    border-left-color: ${theme.purple300};
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

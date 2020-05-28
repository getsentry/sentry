import React from 'react';
import {Global, css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }
  }

  abbr {
    border-bottom: 1px dotted ${theme.gray500};
  }
`;

/**
 * Renders an emotion global styles injection component
 */
const GlobalStyles = ({theme}: {theme: Theme}) => <Global styles={styles(theme)} />;

export default GlobalStyles;

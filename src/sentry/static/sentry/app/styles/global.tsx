import React from 'react';
import {Global, css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }
  }
`;

/**
 * Renders an emotion global styles injection component
 */
const GlobalStyles = ({theme}: {theme: Theme}) => <Global styles={styles(theme)} />;

export default GlobalStyles;

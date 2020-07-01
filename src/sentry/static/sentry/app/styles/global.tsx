/* global process */
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

  /**
   * TODO: This should apply to the prefer-reduced-motion media query
   *
   * See https://web.dev/prefers-reduced-motion/
   */
  ${process.env.IS_CI &&
    css`
      *,
      ::before,
      ::after {
        animation-delay: -1ms !important;
        animation-duration: 0ms !important;
        animation-iteration-count: 1 !important;
        background-attachment: initial !important;
        scroll-behavior: auto !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `}
`;

/**
 * Renders an emotion global styles injection component
 */
const GlobalStyles = ({theme}: {theme: Theme}) => <Global styles={styles(theme)} />;

export default GlobalStyles;

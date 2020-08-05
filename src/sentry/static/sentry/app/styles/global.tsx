import React from 'react';
import {Global, css} from '@emotion/core';

import {IS_CI} from 'app/constants';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    color: ${theme.textColor};
    background-color: ${theme.bodyBackground};

    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }
  }

  a {
    color: ${theme.button.link.color};

    &:hover {
      color: ${theme.button.link.colorActive};
    }
  }

  footer {
    border-top-color: ${theme.border};
  }

  .nav-tabs > li.active a,
  .nav-tabs > li.active a:hover {
    border-bottom-color: ${theme.active};
    color: ${theme.textColor};
  }

  abbr {
    border-bottom: 1px dotted ${theme.gray300};
  }

  /**
   * See https://web.dev/prefers-reduced-motion/
   */
  @media (prefers-reduced-motion) {
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
  }

  ${IS_CI
    ? css`
        input,
        select {
          caret-color: transparent;
        }
      `
    : ''}
`;

/**
 * Renders an emotion global styles injection component
 */
const GlobalStyles = ({theme}: {theme: Theme}) => <Global styles={styles(theme)} />;

export default GlobalStyles;

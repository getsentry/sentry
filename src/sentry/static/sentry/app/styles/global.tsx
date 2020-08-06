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

  .modal-content {
    background: ${theme.background};
  }

  .traceback {
    border-color: ${theme.border};
    background-color: ${theme.background};
  }

  .traceback .frame {
    border-top-color: ${theme.border};
  }

  .traceback .frame .context {
    background-color: ${theme.background};
  }

  .traceback ol.context > li {
    color: ${theme.subText};
  }

  .traceback .frame.system-frame .title {
    background-color: ${theme.backgroundAccent};
  }

  .traceback .frame.system-frame.is-expandable .title:hover {
    background-color: ${theme.background};
  }

  .exc-message {
    color: ${theme.subText};
  }

  pre,
  code {
    background-color: ${theme.backgroundAccent};
    color: ${theme.subText};
  }

  .box {
    background-color: ${theme.backgroundAccent};
    border-color: ${theme.border};
  }

  .modal-dialog {
    border-radius: ${theme.borderRadius};
    border: 1px solid ${theme.border};
  }

  .modal .modal-header {
    border-bottom-color: ${theme.border};
  }

  .modal .modal-footer {
    border-top-color: ${theme.border};
  }

  footer {
    border-top-color: ${theme.border};
  }

  .release-meta {
    color: ${theme.subText};
  }

  .search .search-input,
  .Select-control,
  .Select-menu-outer {
    background: ${theme.background};
    color: ${theme.formText};
  }

  .release-details {
    border-bottom-color: ${theme.border};
  }

  .nav-tabs {
    border-bottom-color: ${theme.border};
  }

  .nav-tabs > li > a {
    color: ${theme.subText};
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

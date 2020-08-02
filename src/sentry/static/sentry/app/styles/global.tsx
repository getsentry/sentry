import React from 'react';
import {Global, css} from '@emotion/core';

import {IS_ACCEPTANCE_TEST} from 'app/constants';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    color: ${theme.textColor};
    background-color: ${theme.bodyBackground};

    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }

    /* TODO(dark): Move this to base.less when ready */
    color: ${theme.textColor};
    background: ${theme.backgroundSecondary};
  }

  a {
    color: ${theme.button.link.color};

    &:hover {
      color: ${theme.button.link.colorActive};
    }
  }

  .val-string {
    color: ${theme.subText};
  }

  .btn-default {
    background: transparent !important;
    color: ${theme.secondaryButton} !important;
    border-color: ${theme.secondaryButton};
  }

  .traceback .frame .btn-toggle {
    background: transparent;
  }

  .modal-content {
    background: ${theme.background};
  }

  .nav-tabs > li > a:hover,
  .nav-tabs > li > a:active,
  .nav-tabs > li > a:focus {
    border-bottom-color: ${theme.active} !important;
    color: ${theme.textColor} !important;
  }

  ul.crumbs li .table.key-value pre {
    color: ${theme.subText};
  }

  .nav-tabs > li.active a,
  .nav-tabs > li.active a:hover {
    color: ${theme.textColor};
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
    background-color: ${theme.backgroundSecondary};
    color: ${theme.subText};
  }

  .box {
    background-color: ${theme.backgroundSecondary};
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

  .help-block {
    color: ${theme.subText} !important;
  }

  abbr {
    border-bottom: 1px dotted ${theme.gray300};
  }

  .group-detail h3 em {
    color: ${theme.subText};
  }

  .context-summary {
    border-top: 1px solid ${theme.border};
  }

  .event-details-container .secondary {
    border-left-color: ${theme.border};
  }

  .nav-header a.help-link {
    color: ${theme.subText};
  }

  .group-stats h6 {
    color: ${theme.textColor};
  }

  .group-stats .env-stats .env-content h6 {
    color: ${theme.subText};
  }

  .group-stats .env-stats > h6 {
    color: ${theme.textColor};
  }

  .group-stats .env-stats > h6::before {
    border-top-color: ${theme.border};
  }

  .group-stats h6::before {
    border-top: 1px solid ${theme.border};
  }

  .group-stats h6 > span,
  .group-stats .env-stats > h6 > span {
    background-color: ${theme.background};
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

  ${IS_ACCEPTANCE_TEST
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

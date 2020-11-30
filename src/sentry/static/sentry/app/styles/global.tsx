import React from 'react';
import {css, Global} from '@emotion/core';

import {IS_ACCEPTANCE_TEST} from 'app/constants';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme, isDark: boolean) => css`
  body {
    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }

    /* TODO(dark): Move this to base.less when ready */
    color: ${theme.textColor};
    background: ${theme.backgroundSecondary};
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

  ${IS_ACCEPTANCE_TEST
    ? css`
        input,
        select {
          caret-color: transparent;
        }
      `
    : ''}

  /* Override css in LESS files here as we want to manually control dark mode for now */
  ${isDark
    ? css`
        .modal-content {
          background: ${theme.background};
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
        .nav-tabs > li > a:hover,
        .nav-tabs > li > a:active,
        .nav-tabs > li > a:focus {
          border-bottom-color: ${theme.purple300} !important; /* TODO(dark): active */
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
          ol.context > li {
            color: ${theme.subText};
          }

          .frame,
          .frame.system-frame {
            border-top-color: ${theme.border};

            &.is-expandable .title:hover {
              background-color: ${theme.background};
            }
            .btn-toggle {
              background: transparent;
            }
            .context {
              background-color: ${theme.background};
            }
            .title {
              background-color: ${theme.backgroundSecondary};
            }
          }
        }

        .exc-message {
          color: ${theme.subText};
        }
        .group-detail h3 em {
          color: ${theme.subText};
        }
        .context-summary {
          border-top: 1px solid ${theme.border};
        }
        .event-details-container {
          background-color: ${theme.background};
          .secondary {
            border-left-color: ${theme.border};
          }
        }
        /* Group Details - User context */
        .user-widget .avatar {
          box-shadow: 0 0 0 5px ${theme.background};
          background: ${theme.background};
        }
        .nav-header a.help-link,
        .nav-header span.help-link a {
          color: ${theme.subText};
        }
        pre,
        code {
          background-color: ${theme.backgroundSecondary};
          color: ${theme.subText};
        }
        .search .search-input,
        .Select-control,
        .Select-menu-outer {
          background: ${theme.background};
          color: ${theme.formText};
        }

        /* Global Selection header date picker */
        .rdrCalendarWrapper {
          background: ${theme.background};
          color: ${theme.textColor};
        }
        .rdrDayDisabled {
          background-color: ${theme.backgroundSecondary};
          color: ${theme.disabled};
        }
        .rdrMonthAndYearPickers select {
          color: ${theme.textColor};
        }
      `
    : ''}
`;

/**
 * Renders an emotion global styles injection component
 */
const GlobalStyles = ({theme, isDark}: {theme: Theme; isDark: boolean}) => (
  <Global styles={styles(theme, isDark)} />
);

export default GlobalStyles;

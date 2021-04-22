import React from 'react';
import {css, Global} from '@emotion/core';

import {IS_ACCEPTANCE_TEST} from 'app/constants';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme, isDark: boolean) => css`
  body {
    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }

    color: ${theme.textColor};
    background: ${theme.backgroundSecondary};
  }

  abbr {
    border-bottom: 1px dotted ${theme.gray300};
  }

  a {
    color: ${theme.linkColor};
    &:hover {
      color: ${theme.linkHoverColor};
    }
  }

  .group-detail:before {
    background: ${theme.border};
  }

  .form-actions {
    border-top-color: ${theme.border};
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
        .box {
          background: ${theme.background};
        }
        .loading .loading-indicator {
          border-color: ${theme.background};
          border-left-color: ${theme.purple300};
        }
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

        .saved-search-tab {
          border-bottom-color: ${theme.active} !important;
        }

        .nav-tabs {
          & > li {
            &.active {
              a {
                color: ${theme.textColor} !important;
                border-bottom-color: ${theme.active} !important;
              }
            }

            a:hover {
              color: ${theme.textColor} !important;
            }
          }
          &.border-bottom {
            border-color: ${theme.border};
          }
        }

        ul.crumbs li .table.key-value pre {
          color: ${theme.subText};
        }

        .exception {
          border-color: ${theme.innerBorder};
        }

        .traceback {
          border-color: ${theme.border};

          ol.context > li {
            color: ${theme.subText};
          }

          &.in-app-traceback {
            .frame {
              &.leads-to-app {
                &.collapsed {
                  .title {
                    border-color: ${theme.border};
                    background: ${theme.background};
                  }
                }
              }
            }
          }

          .frame,
          .frame.system-frame {
            border-top-color: ${theme.border};

            &.is-expandable .title:hover {
              background-color: ${theme.background};
            }
            .btn-toggle {
              color: ${theme.textColor};
              background: transparent;
            }
            .title {
              background-color: ${theme.backgroundSecondary};
            }
            &.is-expandable .title {
              background-color: ${theme.backgroundSecondary};
            }
            .context {
              background: ${theme.background};
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
          color: ${theme.textColor};
        }
        .search .search-input {
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
        .dropdown-menu {
          color: ${theme.textColor};
          background-color: ${theme.background};
          &:after,
          &:before {
            border-bottom-color: ${theme.background};
          }
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

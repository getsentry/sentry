import {css, Global, Theme} from '@emotion/react';

import {prismStyles} from 'sentry/styles/prism';

const styles = (theme: Theme, isDark: boolean) => css`
  body {
    .sentry-error-embed-wrapper {
      z-index: ${theme.zIndex.sentryErrorEmbed};
    }

    color: ${theme.textColor};
    background: ${theme.backgroundSecondary};
  }

  abbr {
    ${theme.tooltipUnderline()};
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

  pre,
  code {
    color: ${theme.textColor};
  }

  pre {
    background-color: ${theme.backgroundSecondary};
    white-space: pre-wrap;
    overflow-x: auto;
  }

  code {
    background-color: transparent;
  }

  ${prismStyles(theme)}

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

  /* Override css in LESS files here as we want to manually control dark mode for now */
  ${isDark
    ? css`
        .box,
        .box.box-modal {
          background: ${theme.background};
          border-color: ${theme.border};

          .box-content,
          .box-header {
            background: ${theme.background};

            h1,
            h2,
            h3,
            h4,
            h5,
            h6 {
              color: ${theme.headingColor};
            }

            a {
              color: ${theme.textColor};
            }
          }

          .box-header {
            border-bottom-color: ${theme.border};
          }
        }
        .loading .loading-indicator {
          border-color: ${theme.backgroundSecondary};
          border-left-color: ${theme.purple300};
        }

        .pattern-bg {
          opacity: 1;
          filter: invert(1) brightness(0.6);
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

              table.key-value {
                border-color: ${theme.border};
                td {
                  border-color: ${theme.border} !important;
                }
              }
            }
          }
        }

        .exc-message {
          color: ${theme.subText};
        }
        .group-detail h3 em {
          color: ${theme.subText};
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
          background-color: ${theme.background} !important;
          border: 1px solid ${theme.border};
          &:before {
            border-bottom-color: ${theme.border};
          }
          &:after {
            border-bottom-color: ${theme.background};
          }
          &.inverted:before {
            border-top-color: ${theme.border};
          }
          &.inverted:after {
            border-top-color: ${theme.background};
          }
        }
      `
    : ''}
`;

/**
 * Renders an emotion global styles injection component
 */
function GlobalStyles({theme, isDark}: {isDark: boolean; theme: Theme}) {
  return <Global styles={styles(theme, isDark)} />;
}

export default GlobalStyles;

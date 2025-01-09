import type {Theme} from '@emotion/react';
import {css, Global} from '@emotion/react';

import {space} from 'sentry/styles/space';

const prismStyles = (theme: Theme) => css`
  :root {
    ${theme.prismVariables};
  }

  /* Use dark Prism theme for code snippets imported from Sentry Docs */
  .gatsby-highlight,
  .prism-dark {
    ${theme.prismDarkVariables};
  }

  pre[class*='language-'] {
    overflow-x: auto;
    padding: ${space(1)} ${space(2)};
    border-radius: ${theme.borderRadius};
    box-shadow: none;

    code {
      background: unset;
    }
  }

  pre[class*='language-'],
  code[class*='language-'] {
    color: var(--prism-base);
    background: var(--prism-block-background);
    font-size: ${theme.codeFontSize};
    text-shadow: none;
    font-family: ${theme.text.familyMono};
    direction: ltr;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    -moz-tab-size: 4;
    -o-tab-size: 4;
    tab-size: 4;
    -webkit-hyphens: none;
    -moz-hyphens: none;
    -ms-hyphens: none;
    hyphens: none;

    .namespace {
      opacity: 0.7;
    }
    .token.comment,
    .token.prolog,
    .token.doctype,
    .token.cdata {
      color: var(--prism-comment);
    }
    .token.punctuation {
      color: var(--prism-punctuation);
    }
    .token.property,
    .token.tag,
    .token.boolean,
    .token.number,
    .token.constant,
    .token.symbol,
    .token.deleted {
      color: var(--prism-property);
    }
    .token.selector,
    .token.attr-name,
    .token.string,
    .token.char,
    .token.builtin,
    .token.inserted {
      color: var(--prism-selector);
    }
    .token.operator,
    .token.entity,
    .token.url,
    .language-css .token.string,
    .style .token.string {
      color: var(--prism-operator);
      background: none;
    }
    .token.atrule,
    .token.attr-value,
    .token.keyword {
      color: var(--prism-keyword);
    }
    .token.function {
      color: var(--prism-function);
    }
    .token.regex,
    .token.important,
    .token.variable {
      color: var(--prism-variable);
    }
    .token.important,
    .token.bold {
      font-weight: ${theme.fontWeightBold};
    }
    .token.italic {
      font-style: italic;
    }
    .token.entity {
      cursor: help;
    }
    .line-highlight {
      position: absolute;
      left: -${space(2)};
      right: 0;
      background: var(--prism-highlight-background);
      box-shadow: inset 5px 0 0 var(--prism-highlight-accent);
      z-index: 0;
      pointer-events: none;
      line-height: inherit;
      white-space: pre;
    }
  }

  pre[data-line] {
    position: relative;
  }

  pre[class*='language-'] > code[class*='language-'] {
    position: relative;
    z-index: 1;
  }
`;

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
    &:focus-visible,
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

    &:focus-visible {
      outline: ${theme.focusBorder} auto 1px;
    }
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

  .ReactVirtualized__Grid:focus-visible,
  .ReactVirtualized__List:focus-visible {
    outline: ${theme.focusBorder} auto 1px;
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

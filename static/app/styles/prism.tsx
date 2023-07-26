import {css, Theme} from '@emotion/react';

import {space} from 'sentry/styles/space';

/**
 * Prism (code highlighting) styles. Added to <GlobalStyles />, so no need to import
 * this into any component.
 */
export const prismStyles = (theme: Theme) => css`
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
      vertical-align: middle;
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
      font-weight: bold;
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

  pre[class*='language-']::selection,
  code[class*='language-']::selection {
    text-shadow: none;
    background: var(--prism-selected);
  }

  pre[data-line] {
    position: relative;
  }

  pre[class*='language-'] > code[class*='language-'] {
    position: relative;
    z-index: 1;
  }
`;

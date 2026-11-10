import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';

const generateThemePrismVariables = (theme: Theme, blockBackground: string) => ({
  '--prism-base': theme.tokens.syntax.base,
  '--prism-inline-code': theme.tokens.syntax.inlineCode,
  '--prism-inline-code-background': theme.tokens.syntax.codeBackground,
  '--prism-highlight-background': theme.tokens.syntax.hightlightBackground,
  '--prism-highlight-accent': theme.tokens.syntax.hightlightAccent,
  '--prism-comment': theme.tokens.syntax.comment,
  '--prism-punctuation': theme.tokens.syntax.punctuation,
  '--prism-property': theme.tokens.syntax.property,
  '--prism-selector': theme.tokens.syntax.selector,
  '--prism-operator': theme.tokens.syntax.operator,
  '--prism-variable': theme.tokens.syntax.variable,
  '--prism-function': theme.tokens.syntax.function,
  '--prism-keyword': theme.tokens.syntax.keyWord,
  // block background differs based on light/dark mode
  '--prism-block-background': blockBackground,
});

export const codeBlockStyles = (theme: Theme) => css`
  ${generateThemePrismVariables(theme, theme.tokens.background.secondary)};
  pre[class*='language-'] {
    overflow-x: auto;
    padding: ${theme.space.md} ${theme.space.xl};
    border-radius: ${theme.radius.md};
    box-shadow: none;

    code {
      background: unset;
    }
  }

  pre[class*='language-'],
  code[class*='language-'] {
    color: var(--prism-base);
    background: var(--prism-block-background);
    font-size: ${theme.font.size.sm};
    text-shadow: none;
    font-family: ${theme.font.family.mono};
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
      font-weight: ${theme.font.weight.sans.medium};
    }
    .token.italic {
      font-style: italic;
    }
    .token.entity {
      cursor: help;
    }
    .line-highlight {
      position: absolute;
      left: -${theme.space.xl};
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

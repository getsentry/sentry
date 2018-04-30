import {css} from 'react-emotion';

const textStyles = props => {
  return css`
    /* stylelint-disable no-descending-specificity */
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p,
    ul,
    ol,
    table,
    dl,
    blockquote,
    form,
    pre,
    .auto-select-text,
    .section,
    [class^='highlight-'] {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      line-height: 1.2;
    }

    p,
    ul,
    ol,
    blockquote {
      line-height: 1.5;
    }

    h1 {
      font-size: 2em;
    }

    h2 {
      font-size: 1.75em;
    }

    h3 {
      font-size: 1.5em;
    }

    h4 {
      font-size: 1.25em;
    }

    h5 {
      font-size: 1em;
    }

    pre {
      word-break: break-all;
      white-space: pre-wrap;
    }
    /* stylelint-enable */
  `;
};

export default textStyles;

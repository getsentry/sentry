import {css} from '@emotion/core';

const textStyles = () => css`
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

  p,
  ul,
  ol,
  blockquote {
    line-height: 1.5;
  }

  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
  /* stylelint-enable */
`;

export default textStyles;

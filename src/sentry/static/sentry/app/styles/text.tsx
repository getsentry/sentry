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
    font-size: 3.2rem;
  }

  h2 {
    font-size: 2.8rem;
  }

  h3 {
    font-size: 2.4rem;
  }

  h4 {
    font-size: 2rem;
  }

  h5 {
    font-size: 1.6rem;
  }

  h6 {
    font-size: 1.4rem;
  }

  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
  /* stylelint-enable */
`;

export default textStyles;

import {css} from '@emotion/react';

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
  /* stylelint-enable */
`;

export default textStyles;

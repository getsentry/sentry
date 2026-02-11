import {css} from '@emotion/react';

/**
 * @deprecated Use `Text` from `@sentry/scraps/text` instead.
 */
const textStyles = () => css`
  /* stylelint-disable no-descending-specificity */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  /* Exclude ol/ul elements inside interactive selectors/menus */
  ul:not([role='listbox'], [role='grid'], [role='menu']),
  ol:not([role='listbox'], [role='grid'], [role='menu']),
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

/**
 * @deprecated Use Prose from `@sentry/scraps/text/prose` instead.
 */
export default textStyles;

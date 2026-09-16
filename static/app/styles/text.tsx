import {css} from '@emotion/react';

/**
 * @deprecated Use `Text` from `@sentry/scraps/text` instead.
 */
export const textStyles = () => css`
  /* stylelint-disable no-descending-specificity */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  /* Exclude ol/ul elements used by interactive controls */
  /* data-panel-body-text-styles lets layout-only lists opt out of PanelBody spacing. */
  ul:not(
    [role='listbox'],
    [role='grid'],
    [role='menu'],
    [role='tablist'],
    [data-panel-body-text-styles='ignore']
  ),
  ol:not([role='listbox'], [role='grid'], [role='menu']),
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

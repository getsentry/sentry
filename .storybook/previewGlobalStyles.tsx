import {css, Global} from '@emotion/react';

import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    font-family: ${theme.text.family};
    font-size: ${theme.fontSizeLarge};
    color: ${theme.gray500};
  }
  div,
  p,
  a,
  span,
  button {
    font-family: ${theme.text.family};
    font-size: 1em;
    color: ${theme.gray500};
  }
  .sbdocs.sbdocs-p,
  .sbdocs.sbdocs-li {
    font-family: ${theme.text.family};
    font-size: 1em;
    color: ${theme.gray500};
  }
  .sbdocs.sbdocs-wrapper code {
    font-family: ${theme.text.familyMono};
    font-size: 0.875em;
    padding: 0.125em 0.5em;
    color: ${theme.gray500};
  }
  .sbdocs.sbdocs-h1,
  .sbdocs.sbdocs-h2,
  .sbdocs.sbdocs-h3,
  .sbdocs.sbdocs-h4,
  .sbdocs.sbdocs-h5,
  .sbdocs.sbdocs-h6 {
    font-family: ${theme.text.family};
    font-weight: 600;
    color: ${theme.gray500};
  }
  .sbdocs.sbdocs-h1 {
    font-size: 2.25em;
    letter-spacing: -0.02em;
    margin-top: 0.4em;
  }
  .sbdocs.sbdocs-h2,
  .sbdocs.sbdocs-h2:first-of-type {
    font-size: 1.875em;
    letter-spacing: -0.01em;
    margin-top: 1em;
  }
  .sbdocs.sbdocs-h3,
  .sbdocs.sbdocs-h3:first-of-type {
    font-size: 1.625em;
    letter-spacing: -0.008em;
    margin-top: 1em;
  }
  .sbdocs.sbdocs-h4,
  .sbdocs.sbdocs-h4:first-of-type {
    font-size: 1.375em;
    margin-top: 1em;
  }
  .sbdocs.sbdocs-h5,
  .sbdocs.sbdocs-h5:first-of-type {
    font-size: 1.25em;
    margin-top: 1em;
  }
  .sbdocs.sbdocs-h6,
  .sbdocs.sbdocs-h6:first-of-type {
    font-size: 1.125em;
    margin-top: 1em;
  }
  .sbdocs.sbdocs-content {
    max-width: 48em;
  }
`;

const PreviewGlobalStyles = ({theme}: {theme: Theme}) => (
  <Global styles={styles(theme)} />
);

export default PreviewGlobalStyles;

import {css, Global} from '@emotion/react';

import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  body {
    font-family: ${theme.text.family};
    font-feature-settings: 'liga';
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

  /** Content wrapw */
  #docs-root {
    display: flex;
    justify-content: center;
    background: ${theme.white};
  }
  .sbdocs.sbdocs-wrapper {
    padding: calc(${space(4)} * 3) calc(${space(4)} * 2);
    justify-content: flex-start;
  }
  .sbdocs.sbdocs-content {
    position: relative;
    max-width: 48em;
  }

  /** Dividers */
  .sbdocs.sbdocs-hr {
    margin: calc(${space(4)} * 2) 0;
    border-top: solid 1px ${theme.gray100};
  }

  /** Body text */
  .sbdocs.sbdocs-p {
    font-family: ${theme.text.family};
    font-size: 1em;
    color: ${theme.gray500};
    margin: ${space(2)} 0;
  }

  /** Links */
  .sbdocs.sbdocs-a {
    font-family: ${theme.text.family};
    font-size: 1em;
    color: ${theme.blue300};
    text-decoration: underline;
    text-decoration-color: ${theme.blue100};
    margin: 0;
  }
  .sbdocs.sbdocs-a:hover {
    text-decoration-color: ${theme.blue200};
  }
  .sbdocs.sbdocs-a.gray-link {
    color: ${theme.gray300};
    text-decoration: none;
  }
  .sbdocs.sbdocs-a.gray-link:hover {
    text-decoration: underline;
    text-decoration-color: ${theme.gray200};
  }

  /** Lists */
  .sbdocs.sbdocs-ul,
  .sbdocs.sbdocs-ol {
    margin: ${space(1)} 0;
  }
  .sbdocs.sbdocs-li,
  .sbdocs.sbdocs-li:first-of-type,
  .sbdocs.sbdocs-li:last-child {
    font-family: ${theme.text.family};
    font-size: 1em;
    color: ${theme.gray500};
    margin: ${space(1)} 0;
  }
  ul > .sbdocs.sbdocs-li ul > .sbdocs.sbdocs-li {
    list-style-type: circle;
  }
  ol > .sbdocs.sbdocs-li ol > .sbdocs.sbdocs-li {
    list-style-type: lower-alpha;
  }

  /** Code */
  .sbdocs.sbdocs-wrapper code {
    font-family: ${theme.text.familyMono};
    font-size: 0.875em;
    padding: 0.125em 0.5em;
    color: ${theme.gray500};
  }

  /** Headings */
  .sbdocs.sbdocs-h1,
  .sbdocs.sbdocs-h2,
  .sbdocs.sbdocs-h3,
  .sbdocs.sbdocs-h4 {
    font-family: ${theme.text.family};
    font-weight: 600;
    color: ${theme.gray500};
    border-bottom: none;
  }
  .sbdocs.sbdocs-h1 {
    font-size: 2.25em;
    letter-spacing: -0.02em;
    margin-bottom: ${space(4)};
  }
  .sbdocs.sbdocs-h2,
  .sbdocs.sbdocs-h2:first-of-type {
    font-size: 1.625em;
    letter-spacing: -0.008em;
    margin-top: 0;
    margin-bottom: ${space(2)};
  }
  .sbdocs.sbdocs-h3,
  .sbdocs.sbdocs-h3:first-of-type {
    font-size: 1.25em;
    margin-top: ${space(4)};
    margin-bottom: ${space(1)};
  }
  .sbdocs.sbdocs-h3:first-of-type {
    margin-top: ${space(2)};
  }
  .sbdocs.sbdocs-h4,
  .sbdocs.sbdocs-h4:first-of-type {
    font-size: 1em;
    margin-top: ${space(3)};
    margin-bottom: ${space(1)};
  }
  .sbdocs.sbdocs-h4:first-of-type {
    margin-top: ${space(2)};
  }
`;

const PreviewGlobalStyles = ({theme}: {theme: Theme}) => (
  <Global styles={styles(theme)} />
);

export default PreviewGlobalStyles;

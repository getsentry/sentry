import {css, Global} from '@emotion/react';

import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

const styles = (theme: Theme) => css`
  html,
  body {
    font-family: ${theme.text.family};
    font-feature-settings: 'liga';
    font-size: ${theme.fontSizeLarge};
    color: ${theme.gray500};
  }
  div,
  p,
  a,
  button {
    font-family: ${theme.text.family};
    font-size: 1rem;
    color: ${theme.gray500};
  }

  /** Content wraps */
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
  .sidebar-container {
    border-right: solid 1px ${theme.gray100};
  }

  /** Dividers */
  .sbdocs.sbdocs-hr {
    margin: calc(${space(4)} * 2) 0;
    border-top: solid 1px ${theme.gray100};
  }

  /** Images */
  .sbdocs.sbdocs-img {
    width: 100%;
    margin: ${space(2)} 0;
  }
  .sbdocs.sbdocs-img.with-border {
    border-radius: ${theme.borderRadius};
    border: solid 1px ${theme.gray100};
  }

  /** Body text */
  .sbdocs.sbdocs-p {
    font-family: ${theme.text.family};
    font-size: 1rem;
    color: ${theme.gray500};
    margin: ${space(2)} 0;
  }
  .sbdocs.small {
    font-size: 0.875rem;
    color: ${theme.gray300};
  }

  /** Links */
  .sbdocs.sbdocs-a {
    font-family: ${theme.text.family};
    font-size: 1rem;
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

  /** Code */
  .sbdocs.sbdocs-pre {
    overflow: visible;
  }
  .sbdocs.sbdocs-wrapper *:not(pre) > code {
    font-family: ${theme.text.familyMono};
    font-size: 1rem;
    padding: 0.125rem 0.25rem;
    color: ${theme.gray500};
    background: ${theme.bodyBackground};
    border: solid 1px ${theme.gray100};
  }

  /** Lists */
  .sbdocs.sbdocs-ul,
  .sbdocs.sbdocs-ol {
    margin: ${space(2)} 0;
  }
  .sbdocs.sbdocs-li,
  .sbdocs.sbdocs-li:first-of-type,
  .sbdocs.sbdocs-li:last-child {
    font-family: ${theme.text.family};
    font-size: 1rem;
    color: ${theme.gray500};
    margin: ${space(1)} 0;
  }
  ul > .sbdocs.sbdocs-li ul > .sbdocs.sbdocs-li {
    list-style-type: circle;
  }
  ol > .sbdocs.sbdocs-li ol > .sbdocs.sbdocs-li {
    list-style-type: lower-alpha;
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
    font-size: 2.25rem;
    letter-spacing: -0.05rem;
    margin-bottom: ${space(4)};
  }
  .sbdocs.sbdocs-h2,
  .sbdocs.sbdocs-h2:first-of-type {
    font-size: 1.625rem;
    letter-spacing: -0.03rem;
    margin-top: 0;
    margin-bottom: ${space(2)};
  }
  .sbdocs.sbdocs-h3,
  .sbdocs.sbdocs-h3:first-of-type {
    font-size: 1.25rem;
    letter-spacing: -0.01rem;
    margin-top: ${space(4)};
    margin-bottom: ${space(1)};
  }
  .sbdocs.sbdocs-h3:first-of-type {
    margin-top: ${space(2)};
  }
  .sbdocs.sbdocs-h4,
  .sbdocs.sbdocs-h4:first-of-type {
    font-size: 1rem;
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

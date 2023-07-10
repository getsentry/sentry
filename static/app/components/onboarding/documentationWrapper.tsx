import styled from '@emotion/styled';

import {AlertProps, alertStyles} from 'sentry/components/alert';
import {space} from 'sentry/styles/space';

type AlertType = AlertProps['type'];

const getAlertSelector = (type: AlertType) =>
  type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

export const DocumentationWrapper = styled('div')`
  /* Size of the new footer + 16px */
  padding-bottom: calc(72px + ${space(2)});

  h2 {
    font-size: 1.375rem;
  }

  h3 {
    font-size: 1.25rem;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  ul,
  ol,
  li {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  blockquote,
  hr,
  pre,
  pre[class*='language-'],
  div[data-language] {
    margin-top: 1em;
    margin-bottom: 1em;
  }

  blockquote {
    padding: ${space(1.5)} ${space(2)};
    ${p => alertStyles({theme: p.theme, type: 'info'})}
  }

  blockquote > * {
    margin: 0;
  }

  .gatsby-highlight:last-child {
    margin-bottom: 0;
  }

  hr {
    border-color: ${p => p.theme.border};
  }

  code {
    color: ${p => p.theme.pink400};
  }

  .alert {
    border-radius: ${p => p.theme.borderRadius};
  }

  /**
   * XXX(epurkhiser): This comes from the doc styles and avoids bottom margin issues in alerts
  */
  .content-flush-bottom *:last-child {
    margin-bottom: 0;
  }

  ${p =>
    Object.keys(p.theme.alert).map(
      type => `
        ${getAlertSelector(type as AlertType)} {
          ${alertStyles({theme: p.theme, type: type as AlertType})};
          display: block;
        }
      `
    )}
`;

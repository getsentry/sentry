import styled from '@emotion/styled';

import {Alert, alertStyles} from 'sentry/components/alert';
import {space} from 'sentry/styles/space';

type AlertType = React.ComponentProps<typeof Alert>['type'];

const getAlertSelector = (type: AlertType) =>
  type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

export const DocumentationWrapper = styled('div')`
  padding-top: ${space(1)};

  /* Size of the new footer + 16px */
  padding-bottom: calc(72px + ${space(2)});

  hr {
    font-size: 1em;
    margin-top: 1em;
    margin-bottom: 1em;
  }

  ul {
    margin-bottom: 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-bottom: 0.25em;
  }

  p {
    margin-bottom: 0.5em;
  }

  .gatsby-highlight {
    margin-top: 1em;
    margin-bottom: 1em;

    &:last-child {
      margin-bottom: 0;
    }
  }

  line-height: 1.5;

  blockquote {
    padding: ${space(1.5)} ${space(2)};
    ${p => alertStyles({theme: p.theme, type: 'info'})}
  }

  blockquote > *:last-child {
    margin-bottom: 0;
  }

  div[data-language] {
    margin-bottom: ${space(2)};
  }

  code {
    color: ${p => p.theme.pink400};
  }

  .alert {
    margin-bottom: ${space(3)};
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

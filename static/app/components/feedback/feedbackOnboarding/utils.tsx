import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export const crashReportCallout = ({link}: {link: string}) => (
  <Alert type="info" showIcon>
    {tct(
      `Interested in receiving feedback only when an error happens? [link:Read the docs] to learn how to set up our crash-report modal.`,
      {
        link: <ExternalLink href={link} />,
      }
    )}
  </Alert>
);

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export default function crashReportCallout({link}: {link: string}) {
  return (
    <Alert type="info" showIcon>
      {tct(
        `Interested in receiving feedback only when an error happens? [link:Read the docs] to learn how to set up our crash-report modal.`,
        {
          link: <ExternalLink href={link} />,
        }
      )}
    </Alert>
  );
}

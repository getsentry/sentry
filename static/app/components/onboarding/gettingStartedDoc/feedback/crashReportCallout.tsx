import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {tct} from 'sentry/locale';

export default function crashReportCallout({link}: {link: string}) {
  return (
    <Alert.Container>
      <Alert variant="info">
        {tct(
          `Interested in receiving feedback only when an error happens? [link:Read the docs] to learn how to set up our crash-report modal.`,
          {
            link: <ExternalLink href={link} />,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

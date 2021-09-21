import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {IconInfo} from 'app/icons';
import {tct} from 'app/locale';

type Props = {
  className?: string;
};

// This alert makes the user aware that a project has been selected for the Low Priority Queue
function GlobalEventProcessingAlert({className}: Props) {
  return (
    <Alert className={className} type="info" icon={<IconInfo size="sm" />}>
      {tct(
        'Event Processing for this project is currently degraded. Events may appear with larger delays than usual or get dropped. Please check the [link:Status] page for a potential outage.',
        {
          link: <ExternalLink href="https://status.sentry.io/" />,
        }
      )}
    </Alert>
  );
}

export default GlobalEventProcessingAlert;

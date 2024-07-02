import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export function MetricsStopIngestionAlert() {
  return (
    <Alert type="error" showIcon>
      {
        // the exact date will be provided later
        tct(
          "We've released a new API to submit metrics. Metrics using with the old API will stop being ingested soon. Read the [link:FAQs] for more details.",
          {
            link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Upcoming-API-Changes-to-Metrics" />
            ),
          }
        )
      }
    </Alert>
  );
}

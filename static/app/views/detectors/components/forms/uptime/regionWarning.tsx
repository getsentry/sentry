import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {tct} from 'sentry/locale';

export function UptimeRegionWarning() {
  return (
    <Alert variant="warning">
      {tct(
        'By enabling uptime monitoring, you acknowledge that uptime check data may be stored outside your selected data region. [link:Learn more].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/organization/data-storage-location/#data-stored-in-us" />
          ),
        }
      )}
    </Alert>
  );
}

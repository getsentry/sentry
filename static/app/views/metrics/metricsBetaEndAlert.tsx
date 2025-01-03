import type {Organization} from 'sentry/types/organization';

import Alert, {type AlertProps} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';

export function MetricsBetaEndAlert({
  style,
  organization,
}: Pick<AlertProps, 'style'> & {organization: Organization}) {
  if (!hasCustomMetrics(organization)) {
    return (
      <Alert type="error" showIcon style={style}>
        {tct(
          'The Metrics beta program has ended on October 7th. This page is still available in read-only mode for 90 days. For more details, please [link:read the FAQs]. Thank you again for participating.',
          {
            link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Metrics-Beta-Coming-to-an-End" />
            ),
          }
        )}
      </Alert>
    );
  }
  return (
    <Alert type="error" showIcon style={style}>
      {tct(
        'Thank you for participating in our Metrics beta program. After careful consideration, we are ending the beta program and will retire the current Metrics solution on Nov 7th. Stay tuned for updates and [link:read the FAQs] for more details.',
        {
          link: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Metrics-Beta-Coming-to-an-End" />
          ),
        }
      )}
    </Alert>
  );
}

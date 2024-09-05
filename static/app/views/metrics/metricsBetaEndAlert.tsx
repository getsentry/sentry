import Alert, {type AlertProps} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export function MetricsBetaEndAlert({style}: Pick<AlertProps, 'style'>) {
  return (
    <Alert type="error" showIcon style={style}>
      {tct(
        'Thank you for participating in our Metrics beta program. After careful consideration, we are ending the beta program and will retire the current Metrics solution on October 7th. Stay tuned for updates and [link:read the FAQs] for more details.',
        {
          link: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Metrics-Beta-Coming-to-an-End" />
          ),
        }
      )}
    </Alert>
  );
}

import Alert, {type AlertProps} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export function MetricsBetaEndAlert({style}: Pick<AlertProps, 'style'>) {
  return (
    <Alert type="error" showIcon style={style}>
      {tct(
        "Thank you for participating in our Metrics beta program. After careful consideration, we are ending the beta and will retire the current Metrics solution on September 30, 2024. We're actively developing a new solution that we believe will make tracking and debugging any issues in your application easier than ever. [link: Learn more].",
        {
          link: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Upcoming-API-Changes-to-Metrics" />
          ),
        }
      )}
    </Alert>
  );
}

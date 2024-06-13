import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import {type ProcessingError, ProcessingErrorType} from 'sentry/views/monitors/types';

interface Props {
  checkinTooltip: React.ReactNode;
  error: ProcessingError;
}

export function ProcessingErrorItem({error, checkinTooltip}: Props) {
  switch (error.type) {
    case ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH:
      return tct(
        'The environment of the second [checkinTooltip:check-in] does not match the original "[env]" environment. Ensure both check-ins have the same environment.',
        {checkinTooltip, env: error.existingEnvironment}
      );
    case ProcessingErrorType.CHECKIN_FINISHED:
      return tct(
        'A [checkinTooltip:check-in] update was sent to a check-in that has already succeeded or failed. Only in-progress check-ins can be updated.',
        {checkinTooltip}
      );
    case ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH:
      return tct(
        'The [checkinTooltip:check-in] GUID provided matched to an existing check-in for a project that is different than the associated project DSN. Use the correct DSN to successfully update your check-in.',
        {checkinTooltip}
      );
    case ProcessingErrorType.CHECKIN_INVALID_DURATION:
      return tct(
        'A [checkinTooltip:check-in] was sent with an invalid duration of "[duration]".',
        {
          checkinTooltip,
          duration: error.duration,
        }
      );
    case ProcessingErrorType.CHECKIN_INVALID_GUID:
      return tct('A [checkinTooltip:check-in] was sent with an invalid GUID.', {
        checkinTooltip,
      });
    case ProcessingErrorType.CHECKIN_VALIDATION_FAILED:
      return tct(
        'A [checkinTooltip:check-in] was sent with an invalid payload. Learn more about the check-in payload in our [link:documentation]',
        {
          checkinTooltip,
          link: (
            <ExternalLink href="https://docs.sentry.io/product/crons/getting-started/http/" />
          ),
        }
      );
    case ProcessingErrorType.MONITOR_DISABLED:
      return tct(
        'A [checkinTooltip:check-in] was sent but was discarded because the monitor is disabled.',
        {checkinTooltip}
      );
    case ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA:
      return tct(
        'A [checkinTooltip:check-in] upsert was sent, but due to insufficient quota a new monitor could not be enabled. Increase your Crons on-demand budget in your [link: subscription settings], and then enable this monitor.',
        {checkinTooltip, link: <Link to="/settings/billing/overview/" />}
      );
    case ProcessingErrorType.MONITOR_INVALID_CONFIG:
      return tct(
        'A monitor failed to upsert due to an invalid [checkinTooltip:check-in] payload provided. Learn more about the check-in payload in our [link:documentation].',
        {
          checkinTooltip,
          link: (
            <ExternalLink href="https://docs.sentry.io/product/crons/getting-started/http/" />
          ),
        }
      );
    case ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT:
      return tct(
        'A [checkinTooltip:check-in] was sent with an invalid environment due to: [reason].',
        {
          checkinTooltip,
          reason: error.reason,
        }
      );
    case ProcessingErrorType.MONITOR_LIMIT_EXCEEDED:
      return tct(
        'The maximum monitor limit for this project has been reached. Please reach out to our [link:sales team] to create additional monitors.',
        {link: <ExternalLink href="https://sentry.io/contact/enterprise/" />}
      );
    case ProcessingErrorType.MONITOR_NOT_FOUND:
      return tct(
        'A [checkinTooltip:check-in] was sent for a monitor that does not exist. If you meant to create a new monitor via upsert, please provide a valid monitor configuration in the check-in payload.',
        {checkinTooltip}
      );
    case ProcessingErrorType.MONITOR_OVER_QUOTA:
      return tct(
        'A [checkinTooltip:check-in] was sent but dropped due to the monitor being disabled. Please increase your on-demand budget if needed in your [link:subscription settings]. Then, enable this monitor to resume processing check-ins.',
        {
          checkinTooltip,
          link: <Link to="/settings/billing/overview/" />,
        }
      );
    case ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED:
      return tct(
        'A [checkinTooltip:check-in] was sent but dropped because the monitor has already reached the limit of allowed environments. Remove an existing environment to create new ones.',
        {checkinTooltip}
      );
    case ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED:
      return tct(
        'A sent [checkinTooltip:check-in] was dropped due to being rate limited. Reivew our rate limits for more information.',
        {checkinTooltip}
      );
    case ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED:
      return tct(
        'We have detected a problem with your organization and disabled check-in ingestion. Contact [link:support] for details.',
        {link: <ExternalLink href="https://sentry.zendesk.com/hc/en-us/requests/new/" />}
      );
    default:
      return tct(
        'Unknown problem occurred while processing this [checkinTooltip:check-in]',
        {checkinTooltip}
      );
  }
}

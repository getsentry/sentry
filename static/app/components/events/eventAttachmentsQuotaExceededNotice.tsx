import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';

type Props = {
  project: Project;
  /**
   * - `all`: none of the event's attachments were stored
   * - `some`: some of the event's attachments were stored
   */
  variant: 'all' | 'some';
};

/**
 * Reason codes of the quotas that limit attachment usage.
 */
const QUOTA_REASON_CODES = new Set([
  'attachment_usage_exceeded',
  'project_quota_attachment_usage_exceeded',
  'usage_exceeded',
]);

function isQuotaReasonCode(reasonCode: string | null | undefined) {
  return !!reasonCode && QUOTA_REASON_CODES.has(reasonCode);
}

/**
 * Whether Relay dropped any of the event's attachments because the attachment
 * quota was exceeded. Other rate limits (spike protection, DSN rate limits, ...)
 * are ignored.
 */
export function hasAttachmentsQuotaExceeded(event: Event) {
  return (
    event.contexts?.attachments?.rate_limited?.some(attachment =>
      isQuotaReasonCode(attachment?.reason_code)
    ) ?? false
  );
}

function getMessage(variant: Props['variant'], statsLink: React.ReactElement) {
  switch (variant) {
    case 'all':
      return tct(
        "This event had attachments, but they weren't stored because your attachment quota was exceeded at the time the event was ingested. [statsLink:View your attachment usage].",
        {statsLink}
      );
    case 'some':
      return tct(
        "Some of this event's attachments weren't stored because your attachment quota was exceeded at the time the event was ingested. [statsLink:View your attachment usage].",
        {statsLink}
      );
  }
}

export function EventAttachmentsQuotaExceededNotice({project, variant}: Props) {
  const organization = useOrganization();
  const statsUrl = {
    pathname: makeStatsPathname({path: '/', organization}),
    query: {dataCategory: 'attachments', project: project.id},
  };

  return (
    <Alert.Container>
      <Alert variant="warning">{getMessage(variant, <Link to={statsUrl} />)}</Alert>
    </Alert.Container>
  );
}

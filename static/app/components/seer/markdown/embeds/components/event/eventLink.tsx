import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {makeEventPathname} from './eventPathnames';

export function getEventLinkTitle({
  id: rawId,
  shortId,
}: Pick<EmbedOutput<'event'>, 'id' | 'shortId'>) {
  const shortEventId = getShortEventId(String(rawId));
  return shortId ? t('%s event %s', shortId, shortEventId) : t('Event %s', shortEventId);
}

export function EventLink({
  format,
  id: rawId,
  issueId: rawIssueId,
  shortId,
}: EmbedOutput<'event'> & ResourceLinkFormatProps) {
  // LLMs sometimes emit numeric values; coerce to string once at the boundary.
  const id = String(rawId);
  const issueId = String(rawIssueId);
  const organization = useOrganization();
  const href = makeEventPathname({
    organizationSlug: organization.slug,
    issueId,
    eventId: id,
  });

  return (
    <ResourceLink
      format={format}
      icon={IconFire}
      href={href}
      title={getEventLinkTitle({id, shortId})}
    />
  );
}

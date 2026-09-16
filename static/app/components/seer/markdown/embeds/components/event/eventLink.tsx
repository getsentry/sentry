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
  id,
  shortId,
}: Pick<EmbedOutput<'event'>, 'id' | 'shortId'>) {
  const shortEventId = getShortEventId(id);
  return shortId ? t('%s event %s', shortId, shortEventId) : t('Event %s', shortEventId);
}

export function EventLink({
  format,
  id,
  issueId,
  shortId,
}: EmbedOutput<'event'> & ResourceLinkFormatProps) {
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

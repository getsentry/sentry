import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getReplaysQueryHref, type ReplaysQueryData} from './replaysQueryUtils';

/**
 * The name the model gave the query, or a description of what it searches. The
 * block renders this as its heading, so both levels name the query the same way.
 */
export function getReplaysQueryTitle(data: ReplaysQueryData): string {
  return data.title ?? t('Replay search');
}

export function ReplaysQueryLink({data}: {data: ReplaysQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconPlay}
      href={getReplaysQueryHref(data, organization)}
      title={getReplaysQueryTitle(data)}
    />
  );
}

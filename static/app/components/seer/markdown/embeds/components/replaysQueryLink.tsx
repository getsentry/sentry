import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getReplaysQueryHref, type ReplaysQueryData} from './replaysQueryUtils';

export function ReplaysQueryLink({data}: {data: ReplaysQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconPlay}
      href={getReplaysQueryHref(data, organization)}
      title={data.title ?? t('Replay search')}
    />
  );
}

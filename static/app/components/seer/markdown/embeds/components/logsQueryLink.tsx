import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getLogsQueryHref, type LogsQueryData} from './logsQueryUtils';

export function LogsQueryLink({data}: {data: LogsQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconList}
      href={getLogsQueryHref(data, organization)}
      title={
        data.title ??
        (data.mode === 'aggregate' ? t('Aggregated log search') : t('Log search'))
      }
    />
  );
}

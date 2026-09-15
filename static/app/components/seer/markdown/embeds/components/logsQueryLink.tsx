import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getLogsQueryHref, type LogsQueryData} from './logsQueryUtils';

/**
 * The name the model gave the query, or a description of what it searches. The
 * block renders this as its heading, so both levels name the query the same way.
 */
export function getLogsQueryTitle(data: LogsQueryData): string {
  return (
    data.title ??
    (data.mode === 'aggregate' ? t('Aggregated log search') : t('Log search'))
  );
}

export function LogsQueryLink({data}: {data: LogsQueryData}) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconList}
      href={getLogsQueryHref(data, organization)}
      title={getLogsQueryTitle(data)}
    />
  );
}

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getLogRowUrl, toProjectId} from './logUtils';

export function LogLink({id, projectId, timestamp}: EmbedOutput<'log'>) {
  const organization = useOrganization();
  const href = getLogRowUrl({
    organization,
    id,
    projectId: toProjectId(projectId),
    timestamp,
  });

  return (
    <ResourceLink icon={IconList} href={href} title={t('Log %s', getShortEventId(id))} />
  );
}

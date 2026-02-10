import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

type Props = {
  searchTerm: string;
  replayId?: string;
};

export function OpenInLogsButton({searchTerm, replayId}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const {selection} = usePageFilters();

  if (!hasExploreEnabled) {
    return null;
  }

  let query = searchTerm || '';
  if (replayId) {
    const existingQuery = query ? `${query} ` : '';
    query = `${existingQuery}replay_id:${replayId}`;
  }

  const url = getLogsUrl({
    organization,
    selection,
    query,
  });

  return (
    <LinkButton size="sm" href={url} target="_blank">
      {t('Open in Logs')}
    </LinkButton>
  );
}

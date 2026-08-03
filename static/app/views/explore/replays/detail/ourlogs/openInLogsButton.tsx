import {LinkButton} from '@sentry/scraps/button';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';

type Props = {
  replayId?: string;
};

export function OpenInLogsButton({replayId}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const {selection} = usePageFilters();
  const logsSearch = useQueryParamsSearch();

  if (!hasExploreEnabled) {
    return null;
  }

  let query = logsSearch.formatString();
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
    <LinkButton size="md" to={url}>
      {t('Open in Logs')}
    </LinkButton>
  );
}

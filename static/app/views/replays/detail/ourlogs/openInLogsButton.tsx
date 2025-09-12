import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

type Props = {
  searchTerm: string;
  traceIds?: string[];
};

export function OpenInLogsButton({searchTerm, traceIds}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const {selection} = usePageFilters();

  if (!hasExploreEnabled) {
    return null;
  }

  // TODO: Replace this with replayId when it's working.
  let query = searchTerm || '';
  if (traceIds?.length) {
    const traceIdValue = `[${traceIds.join(',')}]`;
    const existingQuery = query ? `${query} ` : '';
    query = `${existingQuery}trace:${traceIdValue}`;
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

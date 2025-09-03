import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';

type Props = {
  searchTerm: string;
  traceIds?: string[];
};

export function OpenInLogsButton({searchTerm, traceIds}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  if (!hasExploreEnabled) {
    return null;
  }

  const handleClick = () => {
    const params = new URLSearchParams();

    if (searchTerm) {
      params.set(LOGS_QUERY_KEY, searchTerm);
    }

    if (traceIds?.length) {
      const traceIdValue = `[${traceIds.join(',')}]`;
      const existingQuery = searchTerm ? `${searchTerm} ` : '';
      const queryWithTraces = `${existingQuery}trace:${traceIdValue}`;
      params.set(LOGS_QUERY_KEY, queryWithTraces);
    }

    if (selection.datetime.start && selection.datetime.end) {
      params.set('start', new Date(selection.datetime.start).toISOString());
      params.set('end', new Date(selection.datetime.end).toISOString());
    } else if (selection.datetime.period) {
      params.set('statsPeriod', selection.datetime.period);
    }

    if (selection.datetime.utc) {
      params.set('utc', 'true');
    }

    for (const project of selection.projects) {
      params.append('project', String(project));
    }

    for (const environment of selection.environments) {
      params.append('environment', environment);
    }

    const url = normalizeUrl(
      `/organizations/${organization.slug}/explore/logs/?${params.toString()}`
    );

    navigate(url);
  };

  return (
    <Button size="sm" onClick={handleClick}>
      {t('Open in Logs')}
    </Button>
  );
}

import type EventView from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ResultsChart from 'sentry/views/discover/resultsChart';

export function LogsChart({eventView}: {eventView: EventView}) {
  const organization = useOrganization();
  const api = useApi();
  const location = useLocation();

  return (
    <ResultsChart
      api={api}
      eventView={eventView}
      location={location}
      total={null}
      onAxisChange={() => null}
      onDisplayChange={() => null}
      onIntervalChange={() => null}
      onTopEventsChange={() => null}
      organization={organization}
      confirmedQuery
      yAxis={['count()']}
      hideFooter
    />
  );
}

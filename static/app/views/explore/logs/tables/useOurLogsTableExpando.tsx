import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useOurLogsTableExpando() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('ourlogs-table-expando') ||
    location.query.logsTableExpando === 'true'
  );
}

import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useOurLogsSelectionEnabled() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('ourlogs-selection') ||
    location.query.logsSelection === 'true'
  );
}

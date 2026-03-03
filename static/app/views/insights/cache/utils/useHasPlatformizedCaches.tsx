import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useHasPlatformizedCaches() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('insights-cache-dashboard-migration') ||
    location.query.usePlatformizedView === '1'
  );
}

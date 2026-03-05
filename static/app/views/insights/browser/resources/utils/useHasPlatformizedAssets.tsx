import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedAssets() {
  const organization = useOrganization();
  const location = useLocation();

  if (location.query.usePlatformizedView === '1') {
    return true;
  }

  return organization.features.includes('insights-frontend-assets-dashboard-migration');
}

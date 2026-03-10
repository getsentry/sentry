import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedAiAndMcp() {
  const organization = useOrganization();
  const location = useLocation();

  if (location.query.usePlatformizedView === '1') {
    return true;
  }

  return (
    organization.features.includes('insights-ai-and-mcp-dashboard-migration') &&
    organization.features.includes('performance-view')
  );
}

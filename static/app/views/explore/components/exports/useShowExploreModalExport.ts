import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useShowExploreModalExport() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('explore-modal-export') ||
    location.query.exploreModalExport === 'true'
  );
}

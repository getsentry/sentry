import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useExploreSchemaHintsRemoval() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('explore-schema-hints-removal') ||
    location.query.exploreSchemaHintsRemoval === 'true'
  );
}

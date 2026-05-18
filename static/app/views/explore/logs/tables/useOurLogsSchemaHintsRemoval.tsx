import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useOurLogsSchemaHintsRemoval() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('ourlogs-schema-hints-removal') ||
    location.query.logsSchemaHintsRemoval === 'true'
  );
}

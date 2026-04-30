import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useShowModalExport() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('ourlogs-modal-export') ||
    location.query.logsModalExport === 'true'
  );
}

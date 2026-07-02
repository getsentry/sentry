import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useOurLogsPinningEnabled() {
  const organization = useOrganization();
  const location = useLocation();

  return (
    organization.features.includes('ourlogs-pinning') ||
    location.query.logsPinning === 'true'
  );
}

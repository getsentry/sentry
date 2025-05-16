import {defined} from 'sentry/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  BACKEND_LANDING_SUB_PATH,
  USE_NEW_BACKEND_EXPERIENCE,
} from 'sentry/views/insights/pages/backend/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export const useInsightsEap = (): boolean => {
  const organization = useOrganization();
  const location = useLocation();
  const {isInOverviewPage, view} = useDomainViewFilters();
  const hasEapFlag = organization.features.includes('insights-modules-use-eap');
  const [isNewBackendExperienceEnabled] = useLocalStorageState(
    USE_NEW_BACKEND_EXPERIENCE,
    true
  );

  if (!hasEapFlag) {
    return false;
  }

  if (defined(location.query.useEap)) {
    return location.query.useEap === '1';
  }

  if (view === BACKEND_LANDING_SUB_PATH && isInOverviewPage) {
    return isNewBackendExperienceEnabled;
  }

  return true;
};

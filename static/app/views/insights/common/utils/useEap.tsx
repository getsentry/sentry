import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {EAP_LOCAL_STORAGE_KEY} from 'sentry/views/insights/settings';

export const useInsightsEap = (): boolean => {
  const organization = useOrganization();

  const hasEapFlag = organization.features.includes('insights-modules-use-eap');
  const [isEapEnabledLocalState] = useSyncedLocalStorageState(
    EAP_LOCAL_STORAGE_KEY,
    false
  );

  if (!hasEapFlag) {
    return false;
  }

  return isEapEnabledLocalState;
};

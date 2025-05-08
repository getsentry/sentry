import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export const useInsightsEap = (): boolean => {
  const organization = useOrganization();

  const hasEapFlag = organization.features.includes('insights-modules-use-eap');
  const [isEapEnabledLocalState] = useSyncedLocalStorageState(
    'insights-modules-use-eap',
    false
  );

  if (!hasEapFlag) {
    return false;
  }

  return isEapEnabledLocalState;
};

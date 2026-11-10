import {useQueryState} from 'nuqs';

import {useOrganization} from 'sentry/utils/useOrganization';

export const useInsightsEap = (): boolean => {
  const organization = useOrganization();
  const [eapParam] = useQueryState('useEap');
  const hasEapFlag = organization.features.includes('insights-modules-use-eap');

  if (!hasEapFlag) {
    return false;
  }

  if (eapParam !== null) {
    return eapParam === '1';
  }

  return true;
};

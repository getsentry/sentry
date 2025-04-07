import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const useInsightsEap = (): boolean => {
  const organization = useOrganization();
  const location = useLocation();
  const hasEapFlag = organization.features.includes('insights-modules-use-eap');
  if (!hasEapFlag) {
    return false;
  }

  return location.query?.useEap === '1';
};

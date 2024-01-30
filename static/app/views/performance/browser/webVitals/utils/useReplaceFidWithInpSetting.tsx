import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {REPLACE_FID_WITH_INP} from 'sentry/views/performance/browser/webVitals/settings';

export function useReplaceFidWithInpSetting() {
  const location = useLocation();
  const {query} = location;
  const organization = useOrganization();

  if (query.replaceFidWithInp !== undefined) {
    return decodeScalar(query.replaceFidWithInp) === 'true';
  }

  if (organization.features.includes('starfish-browser-webvitals-replace-fid-with-inp')) {
    return true;
  }

  return REPLACE_FID_WITH_INP;
}

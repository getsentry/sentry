import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';

export function useStoredScoresSetting() {
  const location = useLocation();
  const {query} = location;
  const organization = useOrganization();

  if (query.useStoredScores !== undefined) {
    return decodeScalar(query.useStoredScores) === 'true';
  }

  if (organization.features.includes('starfish-browser-webvitals-use-backend-scores')) {
    return true;
  }

  return USE_STORED_SCORES;
}

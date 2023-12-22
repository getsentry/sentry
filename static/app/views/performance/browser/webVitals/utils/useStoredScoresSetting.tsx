import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';

export function useStoredScoresSetting() {
  const location = useLocation();
  const {query} = location;

  if (query.useStoredScores !== undefined) {
    return decodeScalar(query.useStoredScores) === 'true';
  }

  return USE_STORED_SCORES;
}

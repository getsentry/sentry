import {useLocation} from 'sentry/utils/useLocation';
import {
  DEFAULT_EAP_QUERY_FILTER,
  DEFAULT_QUERY_FILTER,
} from 'sentry/views/insights/browser/webVitals/settings';

export const useDefaultWebVitalsQuery = () => {
  const location = useLocation();
  const useEap = location.query?.useEap === '1';

  if (useEap) {
    return DEFAULT_EAP_QUERY_FILTER;
  }

  return DEFAULT_QUERY_FILTER;
};

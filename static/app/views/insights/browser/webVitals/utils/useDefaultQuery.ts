import {
  DEFAULT_EAP_QUERY_FILTER,
  DEFAULT_QUERY_FILTER,
} from 'sentry/views/insights/browser/webVitals/settings';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';

export const useDefaultWebVitalsQuery = () => {
  const useEap = useInsightsEap();

  if (useEap) {
    return DEFAULT_EAP_QUERY_FILTER;
  }

  return DEFAULT_QUERY_FILTER;
};

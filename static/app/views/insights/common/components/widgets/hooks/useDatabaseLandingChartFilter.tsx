import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';
import {BASE_FILTERS} from 'sentry/views/insights/database/settings';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function useDatabaseLandingChartFilter() {
  const {
    ['span.action']: spanAction,
    ['span.domain']: spanDomain,
    [SpanMetricsField.SPAN_SYSTEM]: systemQueryParam,
  } = useLocationQuery({
    fields: {
      ['span.action']: decodeScalar,
      ['span.domain']: decodeScalar,
      [SpanMetricsField.SPAN_SYSTEM]: decodeScalar,
    },
  });
  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const {selectedSystem} = useSystemSelectorOptions();
  const system = systemQueryParam ?? selectedSystem;

  return {
    ...BASE_FILTERS,
    'span.action': spanAction,
    'span.domain': spanDomain,
    'span.system': system,
  };
}

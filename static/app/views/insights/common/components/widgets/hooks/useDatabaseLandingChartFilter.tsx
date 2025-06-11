import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';
import {BASE_FILTERS} from 'sentry/views/insights/database/settings';
import type {SearchHook} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function useDatabaseLandingChartFilter(): SearchHook {
  const {
    [SpanMetricsField.SPAN_ACTION]: spanAction,
    [SpanMetricsField.SPAN_DOMAIN]: spanDomain,
    [SpanMetricsField.SPAN_SYSTEM]: systemQueryParam,
  } = useLocationQuery({
    fields: {
      [SpanMetricsField.SPAN_ACTION]: decodeScalar,
      [SpanMetricsField.SPAN_DOMAIN]: decodeScalar,
      [SpanMetricsField.SPAN_SYSTEM]: decodeScalar,
    },
  });
  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const {selectedSystem} = useSystemSelectorOptions();
  const system = systemQueryParam ?? selectedSystem;

  const search = MutableSearch.fromQueryObject({
    ...BASE_FILTERS,
    [SpanMetricsField.SPAN_ACTION]: spanAction,
    [SpanMetricsField.SPAN_DOMAIN]: spanDomain,
    [SpanMetricsField.SPAN_SYSTEM]: system,
  });

  return {search, enabled: true};
}

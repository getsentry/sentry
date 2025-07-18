import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';
import {BASE_FILTERS} from 'sentry/views/insights/database/settings';
import type {SearchHook} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

export function useDatabaseLandingChartFilter(): SearchHook {
  const {
    [SpanFields.SPAN_ACTION]: spanAction,
    [SpanFields.SPAN_DOMAIN]: spanDomain,
    [SpanFields.SPAN_SYSTEM]: systemQueryParam,
  } = useLocationQuery({
    fields: {
      [SpanFields.SPAN_ACTION]: decodeScalar,
      [SpanFields.SPAN_DOMAIN]: decodeScalar,
      [SpanFields.SPAN_SYSTEM]: decodeScalar,
    },
  });
  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const {selectedSystem} = useSystemSelectorOptions();
  const system = systemQueryParam ?? selectedSystem;

  const search = MutableSearch.fromQueryObject({
    ...BASE_FILTERS,
    [SpanFields.SPAN_ACTION]: spanAction,
    [SpanFields.SPAN_DOMAIN]: spanDomain,
    [SpanFields.SPAN_SYSTEM]: system,
  });

  return {search, enabled: true};
}

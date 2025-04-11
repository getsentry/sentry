import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function useHttpLandingChartFilter() {
  const query = useLocationQuery({
    fields: {
      'span.domain': decodeScalar,
      [SpanMetricsField.USER_GEO_SUBREGION]: decodeList,
    },
  });

  return {
    ...BASE_FILTERS,
    ...(query[SpanMetricsField.USER_GEO_SUBREGION].length > 0
      ? {
          [SpanMetricsField.USER_GEO_SUBREGION]: `[${query[SpanMetricsField.USER_GEO_SUBREGION].join(',')}]`,
        }
      : {}),
  };
}

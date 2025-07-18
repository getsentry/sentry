import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';
import {SpanFields} from 'sentry/views/insights/types';

export function useHttpLandingChartFilter() {
  const query = useLocationQuery({
    fields: {
      'span.domain': decodeScalar,
      [SpanFields.USER_GEO_SUBREGION]: decodeList,
    },
  });

  return {
    ...BASE_FILTERS,
    ...(query[SpanFields.USER_GEO_SUBREGION].length > 0
      ? {
          [SpanFields.USER_GEO_SUBREGION]: `[${query[SpanFields.USER_GEO_SUBREGION].join(',')}]`,
        }
      : {}),
  };
}

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {EMPTY_OPTION_VALUE, escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';
import {SpanFields} from 'sentry/views/insights/types';

export function useHttpDomainSummaryChartFilter() {
  const {domain, [SpanFields.USER_GEO_SUBREGION]: subregions} = useLocationQuery({
    fields: {
      domain: decodeScalar,
      [SpanFields.USER_GEO_SUBREGION]: decodeList,
    },
  });
  return {
    ...BASE_FILTERS,
    'span.domain': domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(domain),
    ...(subregions.length > 0
      ? {
          [SpanFields.USER_GEO_SUBREGION]: `[${subregions.join(',')}]`,
        }
      : {}),
  };
}

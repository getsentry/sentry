import type {Tag} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useDefaultWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/utils/useDefaultQuery';
import {useMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  tag?: Tag;
  transaction?: string;
};

export const useProjectRawWebVitalsQuery = ({
  transaction,
  tag,
  browserTypes,
  subregions,
}: Props = {}) => {
  const search = new MutableSearch([]);
  const defaultQuery = useDefaultWebVitalsQuery();
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (tag) {
    search.addFilterValue(tag.key, tag.name);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanMetricsField.USER_GEO_SUBREGION, subregions);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanMetricsField.BROWSER_NAME, browserTypes);
  }

  return useMetrics(
    {
      search: [defaultQuery, search.formatString()].join(' ').trim(),
      limit: 50,
      fields: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.inp)',
        'count()',
      ],
    },
    'api.performance.browser.web-vitals.project'
  );
};

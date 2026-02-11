import {getInterval} from 'sentry/components/charts/utils';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  transaction?: string | null;
};

export const useProjectRawWebVitalsValuesTimeseriesQuery = ({
  transaction,
  browserTypes,
  subregions,
}: Props) => {
  const pageFilters = usePageFilters();
  const search = new MutableSearch([]);

  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  const result = useFetchSpanTimeSeries(
    {
      query: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      interval: getInterval(pageFilters.selection.datetime, 'spans-low'),
      yAxis: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.inp)',
        'count()',
        'count_scores(measurements.score.inp)',
      ],
    },
    Referrer.WEB_VITAL_TIMESERIES
  );

  return result;
};

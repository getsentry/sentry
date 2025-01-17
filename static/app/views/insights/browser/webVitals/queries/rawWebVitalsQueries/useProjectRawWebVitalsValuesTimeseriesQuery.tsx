import {getInterval} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  datetime?: PageFilters['datetime'];
  subregions?: SubregionCode[];
  transaction?: string | null;
};

export const useProjectRawWebVitalsValuesTimeseriesQuery = ({
  transaction,
  datetime,
  browserTypes,
  subregions,
}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanIndexedField.USER_GEO_SUBREGION, subregions);
  }
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.inp)',
        'count()',
        'count_scores(measurements.score.inp)',
      ],
      name: 'Web Vitals',
      query: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      version: 2,
      fields: [],
      interval: getInterval(pageFilters.selection.datetime, 'low'),
      dataset: DiscoverDatasets.METRICS,
    },
    {
      ...pageFilters.selection,
      datetime: datetime ?? pageFilters.selection.datetime,
    }
  );

  const result = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    eventView: projectTimeSeriesEventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...projectTimeSeriesEventView.getEventsAPIPayload(location),
      yAxis: projectTimeSeriesEventView.yAxis,
      topEvents: projectTimeSeriesEventView.topEvents,
      excludeOther: 0,
      partial: 1,
      orderby: undefined,
      interval: projectTimeSeriesEventView.interval,
    }),
    options: {
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.timeseries',
  });

  const data: {
    cls: SeriesDataUnit[];
    count: SeriesDataUnit[];
    countInp: SeriesDataUnit[];
    fcp: SeriesDataUnit[];
    inp: SeriesDataUnit[];
    lcp: SeriesDataUnit[];
    ttfb: SeriesDataUnit[];
  } = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    inp: [],
    count: [],
    countInp: [],
  };

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  result?.data?.['p75(measurements.lcp)']?.data.forEach((interval: any, index: any) => {
    const map: {key: string; series: SeriesDataUnit[]}[] = [
      {key: 'p75(measurements.cls)', series: data.cls},
      {key: 'p75(measurements.lcp)', series: data.lcp},
      {key: 'p75(measurements.fcp)', series: data.fcp},
      {key: 'p75(measurements.ttfb)', series: data.ttfb},
      {key: 'p75(measurements.inp)', series: data.inp},
      {key: 'count()', series: data.count},
      {key: 'count_scores(measurements.score.inp)', series: data.countInp},
    ];
    map.forEach(({key, series}) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (result?.data?.[key].data[index][1][0].count !== null) {
        series.push({
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          value: result?.data?.[key].data[index][1][0].count,
          name: interval[0] * 1000,
        });
      }
    });
  });

  return {data, isLoading: result.isPending};
};

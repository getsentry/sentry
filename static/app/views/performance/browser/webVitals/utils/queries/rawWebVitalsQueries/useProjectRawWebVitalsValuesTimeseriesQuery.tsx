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
import {useAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';

type Props = {
  datetime?: PageFilters['datetime'];
  transaction?: string | null;
};

export const useProjectRawWebVitalsValuesTimeseriesQuery = ({
  transaction,
  datetime,
}: Props) => {
  const aggregateFunction = useAggregateFunction();
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        `${aggregateFunction}(measurements.lcp)`,
        `${aggregateFunction}(measurements.fcp)`,
        `${aggregateFunction}(measurements.cls)`,
        `${aggregateFunction}(measurements.ttfb)`,
        `${aggregateFunction}(measurements.fid)`,
        `${aggregateFunction}(measurements.inp)`,
        'count()',
        'count_scores(measurements.score.inp)',
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:[pageload,""]',
        'span.op:[ui.interaction.click,""]',
        search.formatString(),
      ]
        .join(' ')
        .trim(),
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
    fid: SeriesDataUnit[];
    inp: SeriesDataUnit[];
    lcp: SeriesDataUnit[];
    ttfb: SeriesDataUnit[];
  } = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    fid: [],
    inp: [],
    count: [],
    countInp: [],
  };

  result?.data?.[`${aggregateFunction}(measurements.lcp)`]?.data.forEach(
    (interval, index) => {
      const map: {key: string; series: SeriesDataUnit[]}[] = [
        {key: `${aggregateFunction}(measurements.cls)`, series: data.cls},
        {key: `${aggregateFunction}(measurements.lcp)`, series: data.lcp},
        {key: `${aggregateFunction}(measurements.fcp)`, series: data.fcp},
        {key: `${aggregateFunction}(measurements.ttfb)`, series: data.ttfb},
        {key: `${aggregateFunction}(measurements.fid)`, series: data.fid},
        {key: `${aggregateFunction}(measurements.inp)`, series: data.inp},
        {key: 'count()', series: data.count},
        {key: 'count_scores(measurements.score.inp)', series: data.countInp},
      ];
      map.forEach(({key, series}) => {
        if (result?.data?.[key].data[index][1][0].count !== null) {
          series.push({
            value: result?.data?.[key].data[index][1][0].count,
            name: interval[0] * 1000,
          });
        }
      });
    }
  );

  return {data, isLoading: result.isLoading};
};

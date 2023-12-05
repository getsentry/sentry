import {getInterval} from 'sentry/components/charts/utils';
import {PageFilters} from 'sentry/types';
import {SeriesDataUnit} from 'sentry/types/echarts';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  datetime?: PageFilters['datetime'];
  transaction?: string | null;
};

export const useProjectRawWebVitalsValuesTimeseriesQuery = ({
  transaction,
  datetime,
}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        'avg(measurements.lcp)',
        'avg(measurements.fcp)',
        'avg(measurements.cls)',
        'avg(measurements.ttfb)',
        'avg(measurements.fid)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' + (transaction ? ` transaction:"${transaction}"` : ''),
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
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.timeseries',
  });

  const data: {
    cls: SeriesDataUnit[];
    count: SeriesDataUnit[];
    fcp: SeriesDataUnit[];
    fid: SeriesDataUnit[];
    lcp: SeriesDataUnit[];
    ttfb: SeriesDataUnit[];
  } = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    fid: [],
    count: [],
  };

  result?.data?.['avg(measurements.lcp)']?.data.forEach((interval, index) => {
    const map: {key: string; series: SeriesDataUnit[]}[] = [
      {key: 'avg(measurements.cls)', series: data.cls},
      {key: 'avg(measurements.lcp)', series: data.lcp},
      {key: 'avg(measurements.fcp)', series: data.fcp},
      {key: 'avg(measurements.ttfb)', series: data.ttfb},
      {key: 'avg(measurements.fid)', series: data.fid},
      {key: 'count()', series: data.count},
    ];
    map.forEach(({key, series}) => {
      if (result?.data?.[key].data[index][1][0].count !== null) {
        series.push({
          value: result?.data?.[key].data[index][1][0].count,
          name: interval[0] * 1000,
        });
      }
    });
  });

  return {data, isLoading: result.isLoading};
};

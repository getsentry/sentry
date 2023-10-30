import {getInterval} from 'sentry/components/charts/utils';
import {Tag} from 'sentry/types';
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
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';

type Props = {
  tag?: Tag;
  transaction?: string;
};

export const useProjectWebVitalsTimeseriesQuery = ({transaction, tag}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' +
        (transaction ? ` transaction:"${transaction}"` : '') +
        (tag ? ` ${tag.key}:"${tag.name}"` : ''),
      version: 2,
      fields: [],
      interval: getInterval(pageFilters.selection.datetime, 'low'),
      dataset: DiscoverDatasets.METRICS,
    },
    pageFilters.selection
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
  });

  const data: {
    cls: SeriesDataUnit[];
    fcp: SeriesDataUnit[];
    fid: SeriesDataUnit[];
    lcp: SeriesDataUnit[];
    total: SeriesDataUnit[];
    ttfb: SeriesDataUnit[];
  } = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    fid: [],
    total: [],
  };

  result?.data?.['p75(measurements.lcp)'].data.forEach((interval, index) => {
    const lcp: number = result?.data?.['p75(measurements.lcp)'].data[index][1][0].count;
    const fcp: number = result?.data?.['p75(measurements.fcp)'].data[index][1][0].count;
    const cls: number = result?.data?.['p75(measurements.cls)'].data[index][1][0].count;
    const ttfb: number = result?.data?.['p75(measurements.ttfb)'].data[index][1][0].count;
    const fid: number = result?.data?.['p75(measurements.fid)'].data[index][1][0].count;
    // This is kinda jank, but since events-stats zero fills, we need to assume that 0 values mean no data.
    // 0 value for a webvital is low frequency, but not impossible. We may need to figure out a better way to handle this in the future.
    const {totalScore, lcpScore, fcpScore, fidScore, clsScore, ttfbScore} =
      calculatePerformanceScore({
        lcp: lcp === 0 ? Infinity : lcp,
        fcp: fcp === 0 ? Infinity : fcp,
        cls: cls === 0 ? Infinity : cls,
        ttfb: ttfb === 0 ? Infinity : ttfb,
        fid: fid === 0 ? Infinity : fid,
      });

    data.total.push({
      value: totalScore,
      name: interval[0] * 1000,
    });
    data.cls.push({
      value: clsScore,
      name: interval[0] * 1000,
    });
    data.lcp.push({
      value: lcpScore,
      name: interval[0] * 1000,
    });
    data.fcp.push({
      value: fcpScore,
      name: interval[0] * 1000,
    });
    data.ttfb.push({
      value: ttfbScore,
      name: interval[0] * 1000,
    });
    data.fid.push({
      value: fidScore,
      name: interval[0] * 1000,
    });
  });

  return {data, isLoading: result.isLoading};
};

import {getInterval} from 'sentry/components/charts/utils';
import {SeriesDataUnit} from 'sentry/types/echarts';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export const useProjectWebVitalsValuesTimeseriesQuery = () => {
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
      ],
      name: 'Web Vitals',
      query: 'transaction.op:pageload',
      version: 2,
      fields: [],
      interval: getInterval(pageFilters.selection.datetime, 'low'),
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
    data.cls.push({
      value: result?.data?.['p75(measurements.cls)'].data[index][1][0].count,
      name: interval[0] * 1000,
    });
    data.lcp.push({
      value: result?.data?.['p75(measurements.lcp)'].data[index][1][0].count,
      name: interval[0] * 1000,
    });
    data.fcp.push({
      value: result?.data?.['p75(measurements.fcp)'].data[index][1][0].count,
      name: interval[0] * 1000,
    });
    data.ttfb.push({
      value: result?.data?.['p75(measurements.ttfb)'].data[index][1][0].count,
      name: interval[0] * 1000,
    });
    data.fid.push({
      value: result?.data?.['p75(measurements.fid)'].data[index][1][0].count,
      name: interval[0] * 1000,
    });
  });

  return {data, isLoading: result.isLoading};
};

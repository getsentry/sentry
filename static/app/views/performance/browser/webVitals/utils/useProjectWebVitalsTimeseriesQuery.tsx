import {getInterval} from 'sentry/components/charts/utils';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  webVital?: WebVitals | null;
};

export const useProjectWebVitalsTimeseriesQuery = ({webVital}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.app_init_long_tasks)',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload (transaction:/performance* or transaction:/discover* or transaction:/dashboards*)',
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

  const seriesData =
    result?.data?.['p75(measurements.lcp)'].data.map((interval, index) => {
      const {totalScore, ...webVitalScores} = calculatePerformanceScore({
        'p75(measurements.lcp)':
          result?.data?.['p75(measurements.lcp)'].data[index][1][0].count,
        'p75(measurements.fcp)':
          result?.data?.['p75(measurements.fcp)'].data[index][1][0].count,
        'p75(measurements.cls)':
          result?.data?.['p75(measurements.cls)'].data[index][1][0].count,
        'p75(measurements.app_init_long_tasks)':
          result?.data?.['p75(measurements.app_init_long_tasks)'].data[index][1][0].count,
      });
      const score = webVital ? webVitalScores[`${webVital}Score`] : totalScore;
      return {
        value: score,
        name: interval[0] * 1000,
      };
    }) ?? [];

  return {data: seriesData, isLoading: result.isLoading};
};

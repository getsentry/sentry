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

type Props = {
  enabled?: boolean;
  tag?: Tag;
  transaction?: string | null;
};

export type WebVitalsScoreBreakdown = {
  cls: SeriesDataUnit[];
  fcp: SeriesDataUnit[];
  fid: SeriesDataUnit[];
  lcp: SeriesDataUnit[];
  total: SeriesDataUnit[];
  ttfb: SeriesDataUnit[];
};

export const useProjectWebVitalsScoresTimeseriesQuery = ({
  transaction,
  tag,
  enabled = true,
}: Props) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const projectTimeSeriesEventView = EventView.fromNewQueryWithPageFilters(
    {
      yAxis: [
        'weighted_performance_score(measurements.score.lcp)',
        'weighted_performance_score(measurements.score.fcp)',
        'weighted_performance_score(measurements.score.cls)',
        'weighted_performance_score(measurements.score.fid)',
        'weighted_performance_score(measurements.score.ttfb)',
        'count()',
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:pageload has:measurements.score.total',
        ...(transaction ? [`transaction:"${transaction}"`] : []),
        ...(tag ? [`${tag.key}:"${tag.name}"`] : []),
      ].join(' '),
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
      enabled: pageFilters.isReady && enabled,
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.timeseries-scores',
  });

  const data: WebVitalsScoreBreakdown = {
    lcp: [],
    fcp: [],
    cls: [],
    ttfb: [],
    fid: [],
    total: [],
  };

  result?.data?.['weighted_performance_score(measurements.score.lcp)']?.data.forEach(
    (interval, index) => {
      ['lcp', 'fcp', 'cls', 'ttfb', 'fid'].forEach(webVital => {
        data[webVital].push({
          value:
            result?.data?.[`weighted_performance_score(measurements.score.${webVital})`]
              ?.data[index][1][0].count * 100 ?? 0,
          name: interval[0] * 1000,
        });
      });
    }
  );

  return {data, isLoading: result.isLoading};
};

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
        'avg(measurements.score.lcp)',
        'avg(measurements.score.fcp)',
        'avg(measurements.score.cls)',
        'avg(measurements.score.fid)',
        'avg(measurements.score.ttfb)',
        'avg(measurements.score.weight.lcp)',
        'avg(measurements.score.weight.fcp)',
        'avg(measurements.score.weight.cls)',
        'avg(measurements.score.weight.fid)',
        'avg(measurements.score.weight.ttfb)',
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

  result?.data?.['avg(measurements.score.lcp)']?.data.forEach((interval, index) => {
    const lcp: number =
      interval[1][0].count *
      result?.data?.['avg(measurements.score.weight.lcp)']?.data[index][1][0].count *
      100;
    const fcp: number =
      interval[1][0].count *
      result?.data?.['avg(measurements.score.weight.fcp)']?.data[index][1][0].count *
      100;
    const cls: number =
      interval[1][0].count *
      result?.data?.['avg(measurements.score.weight.cls)']?.data[index][1][0].count *
      100;
    const ttfb: number =
      interval[1][0].count *
      result?.data?.['avg(measurements.score.weight.ttfb)']?.data[index][1][0].count *
      100;
    const fid: number =
      interval[1][0].count *
      result?.data?.['avg(measurements.score.weight.fid)']?.data[index][1][0].count *
      100;

    data.cls.push({
      value: cls ?? 0,
      name: interval[0] * 1000,
    });
    data.lcp.push({
      value: lcp ?? 0,
      name: interval[0] * 1000,
    });
    data.fcp.push({
      value: fcp ?? 0,
      name: interval[0] * 1000,
    });
    data.ttfb.push({
      value: ttfb ?? 0,
      name: interval[0] * 1000,
    });
    data.fid.push({
      value: fid ?? 0,
      name: interval[0] * 1000,
    });
  });

  return {data, isLoading: result.isLoading};
};

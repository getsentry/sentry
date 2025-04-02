import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {EAPSpanResponse} from 'sentry/views/insights/types';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {EAPWidgetType} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';

type Options = {
  selectedWidget: EAPWidgetType;
  transactionName: string;
};

type SpanSeriesData = Record<string, DiscoverSeries>;
type DurationPercentilesSeriesData = Array<
  Pick<
    EAPSpanResponse,
    | 'p100(span.duration)'
    | 'p99(span.duration)'
    | 'p95(span.duration)'
    | 'p90(span.duration)'
    | 'p75(span.duration)'
    | 'p50(span.duration)'
  >
>;

/**
 * Determines the query to use for the widget charts based on the selected widget and returns plottable data
 *
 * @param options
 * @returns Plottable[]
 */
export function useWidgetChartQuery({selectedWidget, transactionName}: Options) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );
  const {selection} = usePageFilters();
  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  if (spanCategoryUrlParam) {
    query.addFilterValue('span.category', spanCategoryUrlParam);
  }

  const {
    data: spanSeriesData,
    isPending,
    isError: isSpanSeriesError,
  } = useSpanIndexedSeries(
    {
      yAxis: [
        'avg(span.duration)',
        'p100(span.duration)',
        'p99(span.duration)',
        'p95(span.duration)',
        'p90(span.duration)',
        'p75(span.duration)',
        'p50(span.duration)',
      ],
      search: query,
      transformAliasToInputFormat: true,
      enabled: selectedWidget === EAPWidgetType.DURATION_BREAKDOWN,
    },

    'transaction-summary-charts-widget',
    DiscoverDatasets.SPANS_EAP
  );

  const {data: durationPercentilesSeriesData, isError: isDurationPercentilesError} =
    useEAPSpans(
      {
        fields: [
          'p50(span.duration)',
          'p75(span.duration)',
          'p90(span.duration)',
          'p95(span.duration)',
          'p99(span.duration)',
          'p100(span.duration)',
        ],
        search: query,
        pageFilters: selection,
        enabled: selectedWidget === EAPWidgetType.DURATION_PERCENTILES,
      },
      'api.transaction-summary.span-category-filter'
    );

  let representativeData: SpanSeriesData | DurationPercentilesSeriesData;

  if (selectedWidget === EAPWidgetType.DURATION_BREAKDOWN) {
    representativeData = spanSeriesData;
  } else {
    representativeData = durationPercentilesSeriesData;
  }

  const plottables = getPlottables(
    selectedWidget,
    representativeData,
    isPending,
    isSpanSeriesError || isDurationPercentilesError
  );

  return {
    plottables,
    isPending,
    isError: isSpanSeriesError || isDurationPercentilesError,
  };
}

function getPlottables(
  selectedWidget: EAPWidgetType,
  data: SpanSeriesData | DurationPercentilesSeriesData,
  isPending: boolean,
  isError: boolean
) {
  if (isPending || isError) {
    return [];
  }

  if (selectedWidget === EAPWidgetType.DURATION_BREAKDOWN) {
    const timeSeries: TimeSeries[] = [];
    Object.entries(data as SpanSeriesData).forEach(([key, value]) => {
      timeSeries.push({
        field: key,
        meta: {
          type: value.meta?.fields?.[key] ?? null,
          unit: value.meta?.units?.[key] as DataUnit,
        },
        data:
          value.data.map(item => ({
            timestamp: item.name.toString(),
            value: item.value,
          })) ?? [],
      });
    });

    const plottables = timeSeries.map(series => new Area(series));
    return plottables;
  }

  if (selectedWidget === EAPWidgetType.DURATION_PERCENTILES) {
    console.dir(data);
  }

  return [];
}

import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {EAPWidgetType} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';

type Options = {
  selectedWidget: EAPWidgetType;
  transactionName: string;
};

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
  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  if (spanCategoryUrlParam) {
    query.addFilterValue('span.category', spanCategoryUrlParam);
  }

  const {
    data: spanSeriesData,
    isPending,
    error,
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

  const timeSeries: TimeSeries[] = [];
  Object.entries(spanSeriesData).forEach(([key, value]) => {
    timeSeries.push({
      field: key,
      meta: {
        type: value?.meta?.fields?.[key] ?? null,
        unit: value?.meta?.units?.[key] as DataUnit,
      },
      data:
        value?.data.map(item => ({
          timestamp: item.name.toString(),
          value: item.value,
        })) ?? [],
    });
  });

  const plottables = timeSeries.map(series => new Area(series));

  return {plottables, isPending, error};
}

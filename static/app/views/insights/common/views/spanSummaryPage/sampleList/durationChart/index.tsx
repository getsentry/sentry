import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartHighlightHandler,
  Series,
} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {
  NonDefaultSpanSampleFields,
  SpanSample,
} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useSpanSamples} from 'sentry/views/insights/common/queries/useSpanSamples';
import {AverageValueMarkLine} from 'sentry/views/insights/common/utils/averageValueMarkLine';
import {useSampleScatterPlotSeries} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';
import type {SpanMetricsQueryFilters, SubregionCode} from 'sentry/views/insights/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  additionalFields?: NonDefaultSpanSampleFields[];
  additionalFilters?: Record<string, string>;
  highlightedSpanId?: string;
  onClickSample?: (sample: SpanSample) => void;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  platform?: string;
  release?: string;
  spanDescription?: string;
  spanSearch?: MutableSearch;
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

function DurationChart({
  groupId,
  transactionName,
  onClickSample,
  onMouseLeaveSample,
  onMouseOverSample,
  highlightedSpanId,
  transactionMethod,
  additionalFields,
  release,
  spanSearch,
  platform,
  subregions,
  additionalFilters,
}: Props) {
  const {setPageError} = usePageAlert();
  const theme = useTheme();
  const pageFilter = usePageFilters();

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    filters.release = release;
  }

  if (subregions) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filters[SpanMetricsField.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  if (platform) {
    filters['os.name'] = platform;
  }

  const {
    isPending,
    data: spanMetricsSeriesData,
    error: spanMetricsSeriesError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject({...filters, ...additionalFilters}),
      yAxis: [`avg(${SPAN_SELF_TIME})`],
      enabled: Object.values({...filters, ...additionalFilters}).every(value =>
        Boolean(value)
      ),
    },
    'api.starfish.sidebar-span-metrics-chart'
  );

  const {data, error: spanMetricsError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [`avg(${SPAN_SELF_TIME})`, SPAN_OP],
      enabled: Object.values(filters).every(value => Boolean(value)),
    },
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const avg = spanMetrics?.[`avg(${SPAN_SELF_TIME})`] || 0;

  const {
    data: spanSamplesData,
    isPending: areSpanSamplesLoading,
    isRefetching: areSpanSamplesRefetching,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
    release,
    spanSearch,
    additionalFields,
  });

  const spans = spanSamplesData?.data ?? [];

  const baselineAvgSeries: Series = {
    seriesName: 'Average',
    data: [],
    markLine: AverageValueMarkLine({
      value: avg,
    }),
  };

  const sampledSpanDataSeries = useSampleScatterPlotSeries(spans, avg, highlightedSpanId);

  const getSample = (timestamp: string, duration: number) => {
    return spans.find(s => s.timestamp === timestamp && s[SPAN_SELF_TIME] === duration);
  };

  const handleChartClick: EChartClickHandler = e => {
    const isSpanSample = e?.componentSubType === 'scatter';
    if (isSpanSample && onClickSample) {
      const [timestamp, duration] = e.value as [string, number];
      const sample = getSample(timestamp, duration);
      if (sample) {
        onClickSample(sample);
      }
    }
  };

  const handleChartHighlight: EChartHighlightHandler = event => {
    // ignore mouse hovering over the chart legend
    if (!event.batch) {
      return;
    }

    const firstEventData = event.batch[0];

    if (!defined(firstEventData)) {
      return;
    }

    const {seriesIndex} = firstEventData;

    const isSpanSample =
      seriesIndex > 1 && seriesIndex < 2 + sampledSpanDataSeries.length;
    if (isSpanSample && onMouseOverSample) {
      const spanSampleData = sampledSpanDataSeries?.[seriesIndex - 2]?.data[0];
      const {name: timestamp, value: duration} = spanSampleData!;
      const sample = getSample(timestamp as string, duration);
      if (sample) {
        onMouseOverSample(sample);
      }
    }
    if (!isSpanSample && onMouseLeaveSample) {
      onMouseLeaveSample();
    }
  };

  const handleMouseLeave = () => {
    if (onMouseLeaveSample) {
      onMouseLeaveSample();
    }
  };

  if (spanMetricsSeriesError || spanMetricsError) {
    setPageError(t('An error has occurred while loading chart data'));
  }

  const subtitle = pageFilter.selection.datetime.period
    ? t('Last %s', pageFilter.selection.datetime.period)
    : t('Last period');

  return (
    <ChartPanel title={t('Average Duration')} subtitle={subtitle}>
      <div onMouseLeave={handleMouseLeave}>
        <Chart
          height={140}
          onClick={handleChartClick}
          onHighlight={handleChartHighlight}
          aggregateOutputFormat="duration"
          data={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`], baselineAvgSeries]}
          loading={isPending}
          scatterPlot={
            areSpanSamplesLoading || areSpanSamplesRefetching
              ? undefined
              : sampledSpanDataSeries
          }
          chartColors={[AVG_COLOR(theme), 'black']}
          type={ChartType.LINE}
          definedAxisTicks={4}
        />
      </div>
    </ChartPanel>
  );
}

export default DurationChart;

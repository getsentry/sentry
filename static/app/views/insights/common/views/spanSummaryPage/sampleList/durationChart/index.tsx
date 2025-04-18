import {useEffect, useMemo} from 'react';
import keyBy from 'lodash/keyBy';

import {t} from 'sentry/locale';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';
import {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {
  NonDefaultSpanSampleFields,
  SpanSample,
} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useSpanSamples} from 'sentry/views/insights/common/queries/useSpanSamples';
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
  onMouseLeaveSample?: (sample: SpanSample) => void;
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
      transformAliasToInputFormat: true,
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

  if (spanMetricsSeriesError || spanMetricsError) {
    setPageError(t('An error has occurred while loading chart data'));
  }

  const avg = data.at(0)?.[`avg(${SPAN_SELF_TIME})`] ?? 0;

  const {data: spanSamplesData} = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
    release,
    spanSearch,
    additionalFields,
  });

  const spanSamplesById = useMemo(() => {
    return keyBy(spanSamplesData?.data ?? [], 'span_id');
  }, [spanSamplesData]);

  const samplesPlottable = useMemo(() => {
    if (!spanSamplesData) {
      return undefined;
    }

    return new Samples(spanSamplesData as TabularData, {
      attributeName: SpanMetricsField.SPAN_SELF_TIME,
      baselineValue: avg,
      baselineLabel: t('Average'),
      onClick: sample => {
        onClickSample?.(spanSamplesById[sample.id]!);
      },
      onHighlight: sample => {
        onMouseOverSample?.(spanSamplesById[sample.id]!);
      },
      onDownplay: sample => {
        onMouseLeaveSample?.(spanSamplesById[sample.id]!);
      },
    });
  }, [
    onClickSample,
    onMouseOverSample,
    onMouseLeaveSample,
    spanSamplesData,
    spanSamplesById,
    avg,
  ]);

  useEffect(() => {
    if (samplesPlottable && highlightedSpanId) {
      const spanSample = spanSamplesById[highlightedSpanId]!;
      samplesPlottable.highlight(spanSample);
    }

    return () => {
      if (!highlightedSpanId) {
        return;
      }

      const spanSample = spanSamplesById[highlightedSpanId]!;
      samplesPlottable?.downplay(spanSample);
    };
  }, [samplesPlottable, spanSamplesById, highlightedSpanId]);

  return (
    <InsightsLineChartWidget
      showLegend="never"
      title={t('Average Duration')}
      isLoading={isPending}
      error={spanMetricsSeriesError}
      series={[spanMetricsSeriesData[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
      samples={samplesPlottable}
    />
  );
}

export default DurationChart;

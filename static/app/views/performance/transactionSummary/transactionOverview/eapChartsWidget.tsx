import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanIndexedField} from 'sentry/views/insights/types';

enum EAPWidgetType {
  DURATION_BREAKDOWN = 'duration_breakdown',
  DURATION_PERCENTILES = 'duration_percentiles',
  DURATION_DISTRIBUTION = 'duration_distribution',
  TRENDS = 'trends',
  WEB_VITALS = 'web_vitals',
}

const WIDGET_OPTIONS: Record<EAPWidgetType, {description: string; title: string}> = {
  [EAPWidgetType.DURATION_BREAKDOWN]: {
    title: t('Duration Breakdown'),
    description: t(
      'Duration Breakdown reflects transaction durations by percentile over time.'
    ),
  },
  [EAPWidgetType.DURATION_PERCENTILES]: {
    title: t('Duration Percentiles'),
    description: t(
      `Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`
    ),
  },
  [EAPWidgetType.DURATION_DISTRIBUTION]: {
    title: t('Duration Distribution'),
    description: t(
      'Duration Distribution reflects the volume of transactions per median duration.'
    ),
  },
  [EAPWidgetType.TRENDS]: {
    title: t('Trends'),
    description: t('Trends shows the smoothed value of an aggregate over time.'),
  },
  [EAPWidgetType.WEB_VITALS]: {
    title: t('Web Vitals'),
    description: t(
      'Web Vitals Breakdown reflects the 75th percentile of web vitals over time.'
    ),
  },
};

function getWidgetContents(widgetType: EAPWidgetType) {
  const widget = WIDGET_OPTIONS[widgetType];
  const {title, description} = widget;

  let visualization: React.ReactNode | null = null;

  switch (widgetType) {
    case EAPWidgetType.DURATION_BREAKDOWN:
      visualization = null;
      break;
    case EAPWidgetType.DURATION_PERCENTILES:
      visualization = null;
      break;
    case EAPWidgetType.DURATION_DISTRIBUTION:
      visualization = null;
      break;
    case EAPWidgetType.TRENDS:
      visualization = null;
      break;
    case EAPWidgetType.WEB_VITALS:
      visualization = null;
      break;
    default:
      visualization = null;
  }

  return {title, description, visualization};
}

type EAPChartsWidgetProps = {
  transactionName: string;
};

export function EAPChartsWidget({transactionName}: EAPChartsWidgetProps) {
  const [selectedWidget, setSelectedWidget] = useState<EAPWidgetType>(
    EAPWidgetType.DURATION_BREAKDOWN
  );
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const options = useMemo(() => {
    return Object.entries(WIDGET_OPTIONS).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const {title, description} = getWidgetContents(selectedWidget);

  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  if (spanCategoryUrlParam) {
    query.addFilterValue('span.category', spanCategoryUrlParam);
  }
  query.addFilterValue('is_transaction', '1');

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

  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription title={title} description={description} />
        </Widget.WidgetToolbar>
      }
      Visualization={
        isPending || error ? (
          <TimeSeriesWidgetVisualization.LoadingPlaceholder />
        ) : (
          <TimeSeriesWidgetVisualization
            plottables={timeSeries.map(series => new Area(series))}
          />
        )
      }
      Footer={
        <FooterContainer>
          <CompactSelect
            options={options}
            value={selectedWidget}
            onChange={option => setSelectedWidget(option.value as EAPWidgetType)}
          />
        </FooterContainer>
      }
    />
  );
}

const FooterContainer = styled('div')`
  display: flex;
  align-items: right;
  justify-content: right;
`;

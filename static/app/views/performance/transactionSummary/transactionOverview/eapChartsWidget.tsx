import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useWidgetChartQuery} from 'sentry/views/performance/transactionSummary/transactionOverview/useWidgetChartQuery';

export enum EAPWidgetType {
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

  const options = useMemo(() => {
    return Object.entries(WIDGET_OPTIONS).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const {title, description} = getWidgetContents(selectedWidget);

  const {plottables, isPending, error} = useWidgetChartQuery({
    selectedWidget,
    transactionName,
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
          <TimeSeriesWidgetVisualization plottables={plottables} />
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

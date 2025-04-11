import {useMemo, useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {useWidgetChartVisualization} from 'sentry/views/performance/transactionSummary/transactionOverview/useWidgetChartVisualization';

export enum EAPWidgetType {
  DURATION_BREAKDOWN = 'duration_breakdown',
  DURATION_PERCENTILES = 'duration_percentiles',
  WEB_VITALS = 'web_vitals',
}

const WIDGET_OPTIONS: Record<
  EAPWidgetType,
  {description: string; title: string; disabled?: boolean; spanCategoryTitle?: string}
> = {
  [EAPWidgetType.DURATION_BREAKDOWN]: {
    title: t('Duration Breakdown'),
    spanCategoryTitle: t('Span Category Breakdown'),
    description: t(
      'Duration Breakdown reflects transaction durations by percentile over time.'
    ),
    disabled: false,
  },
  [EAPWidgetType.DURATION_PERCENTILES]: {
    title: t('Duration Percentiles'),
    spanCategoryTitle: t('Span Category Percentiles'),
    description: t(
      `Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`
    ),
    disabled: false,
  },
  // TODO: Histograms are not supported in EAP yet and will be added Post-GA.
  // We can re-enable this once the feature is released.

  // [EAPWidgetType.DURATION_DISTRIBUTION]: {
  //   title: t('Duration Distribution'),
  //   spanCategoryTitle: t('Span Category Distribution'),
  //   description: t(
  //     'Duration Distribution reflects the volume of transactions per median duration.'
  //   ),
  //   disabled: true,
  // },
  [EAPWidgetType.WEB_VITALS]: {
    title: t('Web Vitals'),
    description: t(
      'Web Vitals Breakdown reflects the 75th percentile of web vitals over time.'
    ),
    disabled: true,
  },
};

function getWidgetContents(widgetType: EAPWidgetType, spanCategory?: string) {
  const {title, description, spanCategoryTitle} = WIDGET_OPTIONS[widgetType];

  const content = {title, description};

  if (spanCategory && spanCategoryTitle) {
    content.title = `${spanCategoryTitle} — ${spanCategory}`;
  }

  return content;
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
      disabled: value.disabled,
    }));
  }, []);

  const {title, description} = getWidgetContents(selectedWidget, spanCategoryUrlParam);

  const visualization = useWidgetChartVisualization({
    selectedWidget,
    transactionName,
  });

  return (
    <Widget
      Title={
        <CompactSelect
          options={options}
          value={selectedWidget}
          onChange={option => setSelectedWidget(option.value as EAPWidgetType)}
          triggerProps={{borderless: true, size: 'zero'}}
        />
      }
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription title={title} description={description} />
        </Widget.WidgetToolbar>
      }
      Visualization={visualization}
      revealActions="always"
    />
  );
}

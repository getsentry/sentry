import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

enum EAPWidgetType {
  DURATION_BREAKDOWN = 'duration_breakdown',
  DURATION_PERCENTILES = 'duration_percentiles',
  DURATION_DISTRIBUTION = 'duration_distribution',
  TRENDS = 'trends',
  WEB_VITALS = 'web_vitals',
  // USER_MISERY = 5
}

const WIDGET_OPTIONS: Record<
  EAPWidgetType,
  {description: string; title: string; visualization: React.ReactNode}
> = {
  [EAPWidgetType.DURATION_BREAKDOWN]: {
    title: t('Duration Breakdown'),
    description: t(
      'Duration Breakdown reflects transaction durations by percentile over time.'
    ),
    visualization: null,
  },
  [EAPWidgetType.DURATION_PERCENTILES]: {
    title: t('Duration Percentiles'),
    description: t(
      `Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`
    ),
    visualization: null,
  },
  [EAPWidgetType.DURATION_DISTRIBUTION]: {
    title: t('Duration Distribution'),
    description: t(
      'Duration Distribution reflects the volume of transactions per median duration.'
    ),
    visualization: null,
  },
  [EAPWidgetType.TRENDS]: {
    title: t('Trends'),
    description: t('Trends shows the smoothed value of an aggregate over time.'),
    visualization: null,
  },
  [EAPWidgetType.WEB_VITALS]: {
    title: t('Web Vitals'),
    description: t(
      'Web Vitals Breakdown reflects the 75th percentile of web vitals over time.'
    ),
    visualization: null,
  },
};

export function EAPChartsWidget() {
  const [selectedWidget, setSelectedWidget] = useState<EAPWidgetType>(
    EAPWidgetType.DURATION_BREAKDOWN
  );

  const options = useMemo(() => {
    return Object.entries(WIDGET_OPTIONS).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const widget = WIDGET_OPTIONS[selectedWidget];
  const {title, description, visualization} = widget;

  return (
    <Widget
      Title={<Widget.WidgetTitle title={WIDGET_OPTIONS[selectedWidget].title} />}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription title={title} description={description} />
        </Widget.WidgetToolbar>
      }
      Visualization={visualization}
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

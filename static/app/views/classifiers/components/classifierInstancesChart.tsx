import {Fragment, useState} from 'react';
import {IconClock} from '@sentry/icons/clock';
import {IconGraph} from '@sentry/icons/graph';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getResultAttributeKey} from 'sentry/views/classifiers/utils';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

const TITLE = t('Instances');

const DATETIME: PageFilters['datetime'] = {
  period: '24h',
  start: null,
  end: null,
  utc: null,
};

const INTERVAL_OPTIONS = getIntervalOptionsForPageFilter(DATETIME);

interface ClassifierInstancesChartProps {
  classifier: TelemetryClassifier;
}

export function ClassifierInstancesChart({classifier}: ClassifierInstancesChartProps) {
  const [chartType, setChartType] = useState(ChartType.BAR);
  const [chartInterval, setChartInterval] = useState(INTERVAL_OPTIONS.at(-1)!.value);

  const pageFilters: PageFilters = {
    projects: [Number(classifier.projectId)],
    environments: [],
    datetime: DATETIME,
  };

  const {data, isPending, error} = useFetchEventsTimeSeries(
    DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
    {
      yAxis: `count(tags[${getResultAttributeKey(classifier.resultAttribute)},number])`,
      interval: chartInterval,
      pageFilters,
    },
    'api.classifiers.detail.instances-chart'
  );

  const PlottableConstructor =
    chartType === ChartType.LINE ? Line : chartType === ChartType.AREA ? Area : Bars;
  const timeSeries = data?.timeSeries ?? [];
  const hasInstances = timeSeries.some(series =>
    series.values.some(item => !!item.value)
  );
  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  let visualization: React.ReactNode;
  if (isPending) {
    visualization = <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  } else if (error) {
    visualization = (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={error} />
      </Container>
    );
  } else if (hasInstances) {
    visualization = (
      <TimeSeriesWidgetVisualization
        pageFilters={pageFilters}
        disableZoom
        showLegend="never"
        plottables={timeSeries.map(
          series => new PlottableConstructor(series, {alias: TITLE})
        )}
      />
    );
  } else {
    visualization = <TimeSeriesWidgetVisualization.NoData />;
  }

  const actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Chart type')}
              icon={<IconGraph type={chartIcon} />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={chartType}
          menuTitle={t('Type')}
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={chartInterval}
          menuTitle={t('Interval')}
          options={INTERVAL_OPTIONS}
          onChange={option => setChartInterval(option.value)}
        />
      </Tooltip>
    </Fragment>
  );

  return (
    <Container height="240px">
      <Widget
        Title={<Widget.WidgetTitle title={TITLE} />}
        Actions={actions}
        revealActions="always"
        Visualization={visualization}
      />
    </Container>
  );
}

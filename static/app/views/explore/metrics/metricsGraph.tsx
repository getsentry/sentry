import {Fragment, useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconClock, IconEllipsis, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {ConfidenceFooter} from 'sentry/views/explore/metrics/metricsConfidenceFooter';
import type {useMetricsTimeSeries} from 'sentry/views/explore/metrics/useMetricsTimeSeries';
import {
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {type Visualize} from 'sentry/views/explore/queryParams/visualize';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

interface MetricsGraphProps {
  timeseriesResult: ReturnType<typeof useMetricsTimeSeries>;
}

export function MetricsGraph({timeseriesResult}: MetricsGraphProps) {
  const visualizes = useQueryParamsVisualizes();
  const setVisualizes = useSetQueryParamsVisualizes();

  function handleChartTypeChange(index: number, chartType: ChartType) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({chartType});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  function handleChartVisibilityChange(index: number, visible: boolean) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({visible});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  return (
    <Fragment>
      {visualizes.map((visualize, index) => {
        return (
          <Graph
            key={index}
            visualize={visualize}
            timeseriesResult={timeseriesResult}
            onChartTypeChange={chartType => handleChartTypeChange(index, chartType)}
            onChartVisibilityChange={visible =>
              handleChartVisibilityChange(index, visible)
            }
          />
        );
      })}
    </Fragment>
  );
}

interface GraphProps extends MetricsGraphProps {
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  visualize: Visualize;
}

function Graph({
  onChartTypeChange,
  onChartVisibilityChange,
  timeseriesResult,
  visualize,
}: GraphProps) {
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();

  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const chartInfo = useMemo(() => {
    const series = timeseriesResult.data?.[aggregate] ?? [];
    const isTopEvents = defined(topEventsLimit);
    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
    return {
      chartType: visualize.chartType,
      series,
      timeseriesResult,
      yAxis: aggregate,
      confidence: combineConfidenceForSeries(series),
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
      topEvents: isTopEvents ? TOP_EVENTS_LIMIT : undefined,
    };
  }, [visualize.chartType, timeseriesResult, aggregate, topEventsLimit]);

  const Title = (
    <Widget.WidgetTitle title={prettifyAggregation(aggregate) ?? aggregate} />
  );

  const chartIcon =
    visualize.chartType === ChartType.LINE
      ? 'line'
      : visualize.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          triggerProps={{
            icon: <IconGraph type={chartIcon} />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          value={visualize.chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => onChartTypeChange(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={({value}) => setInterval(value)}
          triggerProps={{
            icon: <IconClock />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      <ContextMenu visible={visualize.visible} setVisible={onChartVisibilityChange} />
    </Fragment>
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={visualize.visible && <ChartVisualization chartInfo={chartInfo} />}
      Footer={
        visualize.visible && (
          <ConfidenceFooter
            chartInfo={chartInfo}
            isLoading={timeseriesResult.isLoading}
          />
        )
      }
      height={visualize.visible ? 200 : 50}
      revealActions="always"
    />
  );
}

function ContextMenu({
  visible,
  setVisible,
}: {
  setVisible: (visible: boolean) => void;
  visible: boolean;
}) {
  const items: MenuItemProps[] = useMemo(() => {
    const menuItems = [];

    // TODO: Add create alert functionality for metrics
    // Feature flag: trace-metrics-alerts

    // TODO: Add dashboard functionality for metrics
    // Feature flag: trace-metrics-dashboards

    if (visible) {
      menuItems.push({
        key: 'hide-chart',
        textValue: t('Hide Chart'),
        label: t('Hide Chart'),
        onAction: () => setVisible(false),
      });
    } else {
      menuItems.push({
        key: 'show-chart',
        textValue: t('Show Chart'),
        label: t('Show Chart'),
        onAction: () => setVisible(true),
      });
    }

    return menuItems;
  }, [setVisible, visible]);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu
      triggerProps={{
        size: 'xs',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis />,
      }}
      position="bottom-end"
      items={items}
    />
  );
}

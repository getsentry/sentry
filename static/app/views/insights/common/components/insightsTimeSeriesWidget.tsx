import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  LegendSelection,
  TimeSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import type {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {WidgetTitleProps} from 'sentry/views/dashboards/widgets/widget/widgetTitle';
import {
  AVG_COLOR,
  COUNT_COLOR,
  HTTP_RESPONSE_3XX_COLOR,
  HTTP_RESPONSE_4XX_COLOR,
  HTTP_RESPONSE_5XX_COLOR,
  THROUGHPUT_COLOR,
} from 'sentry/views/insights/colors';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {ChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {
  ChartContainer,
  ModalChartContainer,
} from 'sentry/views/insights/common/components/insightsChartContainer';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/types';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {BASE_FIELD_ALIASES, INGESTION_DELAY} from 'sentry/views/insights/settings';
import type {SpanFields} from 'sentry/views/insights/types';

export interface InsightsTimeSeriesWidgetProps
  extends WidgetTitleProps, LoadableChartWidgetProps {
  error: Error | null;
  isLoading: boolean;
  visualizationType: 'line' | 'area' | 'bar';
  aliases?: Record<string, string>;
  /**
   * Optional color palette that will be used inplace of COMMON_COLORS.
   */
  colorPalette?: readonly string[];
  description?: React.ReactNode;
  extraActions?: React.ReactNode[];
  extraPlottables?: Plottable[];
  height?: string | number;
  interactiveTitle?: () => React.ReactNode;
  legendSelection?: LegendSelection | undefined;
  onLegendSelectionChange?: ((selection: LegendSelection) => void) | undefined;
  pageFilters?: PageFilters;
  /**
   * Query info to be used for the open in explore and create alert actions,
   * yAxis should only be provided if it's expected to be different when opening in explore
   */
  queryInfo?: {
    referrer: string;
    search: MutableSearch;
    groupBy?: SpanFields[];
    interval?: string;
    yAxis?: string[];
  };
  samples?: Samples;
  /**
   * During the transition from the `/events-stats/` endpoint to the `/events-timeseries/` endpoint we accept both `timeSeries` and `series` so different components can pass different data. Eventually `series` will go away.
   */
  series?: DiscoverSeries[];
  showLegend?: TimeSeriesWidgetVisualizationProps['showLegend'];
  showReleaseAs?: 'line' | 'bubble' | 'none';
  stacked?: boolean;
  /**
   * During the transition from the `/events-stats/` endpoint to the `/events-timeseries/` endpoint we accept both `timeSeries` and `series` so different components can pass different data. Eventually `timeSeries` will take over.
   */
  timeSeries?: TimeSeries[];
}

export function InsightsTimeSeriesWidget(props: InsightsTimeSeriesWidgetProps) {
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const pageFiltersSelection = props.pageFilters || pageFilters.selection;
  const {releases: releasesWithDate} = useReleaseStats(pageFiltersSelection, {
    enabled: props.showReleaseAs !== 'none',
  });
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  const aliases: Record<string, string> = {
    ...BASE_FIELD_ALIASES,
    ...props?.aliases,
  };

  const PlottableDataConstructor =
    props.visualizationType === 'line'
      ? Line
      : props.visualizationType === 'area'
        ? Area
        : Bars;

  const yAxes = new Set<string>();
  const plottables = [
    ...(props.series?.filter(Boolean) ?? []).map(serie => {
      const delayedTimeSeries = markDelayedData(
        convertSeriesToTimeseries(serie),
        INGESTION_DELAY
      );

      // yAxis should not contain whitespace, some yAxes are like `epm() span.op:queue.publish`
      yAxes.add(delayedTimeSeries?.yAxis?.split(' ')[0] ?? '');

      return new PlottableDataConstructor(delayedTimeSeries, {
        color: serie.color ?? COMMON_COLORS(theme)[delayedTimeSeries.yAxis],
        stack: props.stacked && props.visualizationType === 'bar' ? 'all' : undefined,
        alias: aliases?.[delayedTimeSeries.yAxis],
      });
    }),
    ...(props.timeSeries?.filter(Boolean) ?? []).map((timeSeries, idx) => {
      // TODO: After merge of ENG-5375 we don't need to run `markDelayedData` on output of `/events-timeseries/`
      const delayedTimeSeries = markDelayedData(timeSeries, INGESTION_DELAY);

      yAxes.add(timeSeries.yAxis);

      let alias = aliases?.[delayedTimeSeries.yAxis];
      const plottableName = formatTimeSeriesName(delayedTimeSeries);
      if (aliases?.[plottableName]) {
        alias = aliases?.[plottableName];
      }

      return new PlottableDataConstructor(delayedTimeSeries, {
        color: props.colorPalette?.[idx] ?? COMMON_COLORS(theme)[plottableName],
        stack: props.stacked && props.visualizationType === 'bar' ? 'all' : undefined,
        alias,
      });
    }),
    ...(props.extraPlottables ?? []),
  ];

  const visualizationProps: TimeSeriesWidgetVisualizationProps = {
    showLegend: props.showLegend,
    plottables,
  };

  if (props.samples) {
    visualizationProps.plottables.push(props.samples);
  }

  const Title = props.interactiveTitle ? (
    props.interactiveTitle()
  ) : (
    <Widget.WidgetTitle title={props.title} />
  );

  // TODO: Instead of using `ChartContainer`, enforce the height from the parent layout
  if (props.isLoading) {
    return (
      <ChartContainer height={props.height}>
        <Widget
          Title={Title}
          Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        />
      </ChartContainer>
    );
  }

  if (props.error) {
    return (
      <ChartContainer height={props.height}>
        <Widget
          Title={Title}
          Visualization={<Widget.WidgetError error={props.error} />}
        />
      </ChartContainer>
    );
  }

  if (
    [...(props.series ?? []), ...(props.timeSeries ?? [])].filter(Boolean).length === 0
  ) {
    return (
      <ChartContainer height={props.height}>
        <Widget
          Title={Title}
          Visualization={<Widget.WidgetError error={MISSING_DATA_MESSAGE} />}
        />
      </ChartContainer>
    );
  }

  let chartType = ChartType.LINE;
  if (props.visualizationType === 'area') {
    chartType = ChartType.AREA;
  } else if (props.visualizationType === 'bar') {
    chartType = ChartType.BAR;
  }

  const yAxisArray = props.queryInfo?.yAxis || [...yAxes];

  return (
    <ChartContainer height={props.height}>
      <Widget
        Title={Title}
        Visualization={
          <TimeSeriesWidgetVisualization
            chartRef={props.chartRef}
            id={props.id}
            pageFilters={props.pageFilters}
            releases={releases}
            showReleaseAs={props.showReleaseAs || 'bubble'}
            onZoom={props.onZoom}
            legendSelection={props.legendSelection}
            onLegendSelectionChange={props.onLegendSelectionChange}
            {...visualizationProps}
          />
        }
        Actions={
          <Widget.WidgetToolbar>
            {props.description && (
              <Widget.WidgetDescription description={props.description} />
            )}
            {props.extraActions}
            {props.queryInfo && (
              <ChartActionDropdown
                chartType={chartType}
                yAxes={yAxisArray}
                groupBy={props.queryInfo?.groupBy}
                title={props.title}
                search={props.queryInfo?.search}
                aliases={aliases}
                referrer={props.queryInfo?.referrer ?? ''}
                interval={props.queryInfo?.interval}
              />
            )}
            {props.loaderSource !== 'releases-drawer' && (
              <Button
                size="xs"
                aria-label={t('Open Full-Screen View')}
                priority="transparent"
                icon={<IconExpand />}
                onClick={() => {
                  openInsightChartModal({
                    title: props.title,
                    children: (
                      <ModalChartContainer>
                        <TimeSeriesWidgetVisualization
                          id={props.id}
                          {...visualizationProps}
                          onZoom={() => {}}
                          legendSelection={props.legendSelection}
                          onLegendSelectionChange={props.onLegendSelectionChange}
                          showReleaseAs={props.showReleaseAs || 'bubble'}
                          releases={releases ?? []}
                        />
                      </ModalChartContainer>
                    ),
                  });
                }}
              />
            )}
          </Widget.WidgetToolbar>
        }
      />
    </ChartContainer>
  );
}

const COMMON_COLORS = (theme: Theme): Record<string, string> => {
  const colors = theme.chart.getColorPalette(2);
  const vitalColors = theme.chart.getColorPalette(4);
  return {
    'epm()': THROUGHPUT_COLOR(theme),
    'count()': COUNT_COLOR(theme),
    'avg(span.self_time)': AVG_COLOR(theme),
    'http_response_rate(3)': HTTP_RESPONSE_3XX_COLOR,
    'http_response_rate(4)': HTTP_RESPONSE_4XX_COLOR,
    'http_response_rate(5)': HTTP_RESPONSE_5XX_COLOR,
    'avg(messaging.message.receive.latency)': colors[1],
    'avg(span.duration)': colors[2],
    'performance_score(measurements.score.lcp)': vitalColors[0],
    'performance_score(measurements.score.fcp)': vitalColors[1],
    'performance_score(measurements.score.inp)': vitalColors[2],
    'performance_score(measurements.score.cls)': vitalColors[3],
    'performance_score(measurements.score.ttfb)': vitalColors[4],
    'epm() : span.op : queue.publish': colors[1],
    'epm() : span.op : queue.process': colors[2],
  };
};

import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';
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
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {BASE_FIELD_ALIASES, INGESTION_DELAY} from 'sentry/views/insights/settings';
import type {SpanFields} from 'sentry/views/insights/types';

export interface InsightsTimeSeriesWidgetProps
  extends WidgetTitleProps,
    LoadableChartWidgetProps {
  error: Error | null;
  isLoading: boolean;
  series: DiscoverSeries[];
  visualizationType: 'line' | 'area' | 'bar';
  aliases?: Record<string, string>;
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
    yAxis?: string[];
  };

  samples?: Samples;
  showLegend?: TimeSeriesWidgetVisualizationProps['showLegend'];
  showReleaseAs?: 'line' | 'bubble' | 'none';
  stacked?: boolean;
}

export function InsightsTimeSeriesWidget(props: InsightsTimeSeriesWidgetProps) {
  const theme = useTheme();
  const useEap = useInsightsEap();
  const organization = useOrganization();
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

  const hasChartActionsEnabled =
    organization.features.includes('insights-chart-actions') && useEap && props.queryInfo;
  const yAxes = new Set<string>();
  const plottables = [
    ...(props.series.filter(Boolean) ?? []).map(serie => {
      const timeSeries = markDelayedData(
        convertSeriesToTimeseries(serie),
        INGESTION_DELAY
      );
      const PlottableDataConstructor =
        props.visualizationType === 'line'
          ? Line
          : props.visualizationType === 'area'
            ? Area
            : Bars;

      // yAxis should not contain whitespace, some yAxes are like `epm() span.op:queue.publish`
      yAxes.add(timeSeries?.yAxis?.split(' ')[0] ?? '');

      return new PlottableDataConstructor(timeSeries, {
        color: serie.color ?? COMMON_COLORS(theme)[timeSeries.yAxis],
        stack: props.stacked && props.visualizationType === 'bar' ? 'all' : undefined,
        alias: aliases?.[timeSeries.yAxis],
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

  if (props.series.filter(Boolean).length === 0) {
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
            {hasChartActionsEnabled && (
              <ChartActionDropdown
                chartType={chartType}
                yAxes={yAxisArray}
                groupBy={props.queryInfo?.groupBy}
                title={props.title}
                search={props.queryInfo?.search}
                aliases={aliases}
                referrer={props.queryInfo?.referrer ?? ''}
              />
            )}
            {props.loaderSource !== 'releases-drawer' && (
              <Button
                size="xs"
                aria-label={t('Open Full-Screen View')}
                borderless
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
  return {
    'epm()': THROUGHPUT_COLOR(theme),
    'count()': COUNT_COLOR(theme),
    'avg(span.self_time)': AVG_COLOR(theme),
    'http_response_rate(3)': HTTP_RESPONSE_3XX_COLOR,
    'http_response_rate(4)': HTTP_RESPONSE_4XX_COLOR,
    'http_response_rate(5)': HTTP_RESPONSE_5XX_COLOR,
    'avg(messaging.message.receive.latency)': colors[1],
    'avg(span.duration)': colors[2],
  };
};

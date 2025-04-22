import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
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
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

export interface InsightsTimeSeriesWidgetProps
  extends WidgetTitleProps,
    Omit<LoadableChartWidgetProps, 'chartProperties'>,
    Partial<Pick<LoadableChartWidgetProps, 'chartProperties'>> {
  error: Error | null;
  isLoading: boolean;
  series: DiscoverSeries[];
  visualizationType: 'line' | 'area' | 'bar';
  aliases?: Record<string, string>;
  description?: React.ReactNode;
  height?: string | number;
  interactiveTitle?: () => React.ReactNode;
  legendSelection?: LegendSelection | undefined;
  onLegendSelectionChange?: ((selection: LegendSelection) => void) | undefined;
  samples?: Samples;
  showLegend?: TimeSeriesWidgetVisualizationProps['showLegend'];
  stacked?: boolean;
}

export function InsightsTimeSeriesWidget(props: InsightsTimeSeriesWidgetProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const pageFiltersSelection = props.pageFilters || pageFilters.selection;
  const {releases: releasesWithDate} = useReleaseStats(pageFiltersSelection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  const visualizationProps: TimeSeriesWidgetVisualizationProps = {
    showLegend: props.showLegend,
    plottables: (props.series.filter(Boolean) ?? [])?.map(serie => {
      const timeSeries = convertSeriesToTimeseries(serie);
      const PlottableDataConstructor =
        props.visualizationType === 'line'
          ? Line
          : props.visualizationType === 'area'
            ? Area
            : Bars;

      return new PlottableDataConstructor(timeSeries, {
        color: serie.color ?? COMMON_COLORS(theme)[timeSeries.field],
        delay: INGESTION_DELAY,
        stack: props.stacked && props.visualizationType === 'bar' ? 'all' : undefined,
        alias: props.aliases?.[timeSeries.field],
      });
    }),
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

  const enableReleaseBubblesProps = organization.features.includes('release-bubbles-ui')
    ? ({releases, showReleaseAs: props.showReleaseAs || 'bubble'} as const)
    : {};

  return (
    <ChartContainer height={props.height}>
      <Widget
        Title={Title}
        Visualization={
          <TimeSeriesWidgetVisualization
            id={props.id}
            pageFilters={props.pageFilters}
            {...enableReleaseBubblesProps}
            legendSelection={props.legendSelection}
            onLegendSelectionChange={props.onLegendSelectionChange}
            chartProperties={props.chartProperties}
            {...visualizationProps}
          />
        }
        Actions={
          <Widget.WidgetToolbar>
            {props.description && (
              <Widget.WidgetDescription description={props.description} />
            )}
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
                        {...enableReleaseBubblesProps}
                        onZoom={() => {}}
                        legendSelection={props.legendSelection}
                        onLegendSelectionChange={props.onLegendSelectionChange}
                        releases={releases ?? []}
                        chartProperties={props.chartProperties}
                      />
                    </ModalChartContainer>
                  ),
                });
              }}
            />
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

const ChartContainer = styled('div')<{height?: string | number}>`
  min-height: 220px;
  height: ${p =>
    p.height ? (typeof p.height === 'string' ? p.height : `${p.height}px`) : '220px'};
`;

const ModalChartContainer = styled('div')`
  height: 360px;
`;

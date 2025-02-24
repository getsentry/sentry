import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {Aliases} from 'sentry/views/dashboards/widgets/common/types';
import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

import {
  AVG_COLOR,
  COUNT_COLOR,
  HTTP_RESPONSE_3XX_COLOR,
  HTTP_RESPONSE_4XX_COLOR,
  HTTP_RESPONSE_5XX_COLOR,
  THROUGHPUT_COLOR,
} from '../../colors';
import type {DiscoverSeries} from '../queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from '../utils/convertSeriesToTimeseries';

export interface InsightsTimeSeriesWidgetProps {
  error: Error | null;
  isLoading: boolean;
  series: DiscoverSeries[];
  title: string;
  visualizationType: TimeSeriesWidgetVisualizationProps['visualizationType'];
  aliases?: Aliases;
  stacked?: boolean;
}

export function InsightsTimeSeriesWidget(props: InsightsTimeSeriesWidgetProps) {
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const {projects, environments} = pageFilters.selection;

  const visualizationProps: TimeSeriesWidgetVisualizationProps = {
    visualizationType: props.visualizationType,
    timeSeries: (props.series.filter(Boolean) ?? [])?.map(serie => {
      const timeserie = convertSeriesToTimeseries(serie);

      return {
        ...timeserie,
        color: serie.color ?? COMMON_COLORS[timeserie.field],
      };
    }),
    aliases: props.aliases,
    stacked: props.stacked,
  };

  const Title = <Widget.WidgetTitle title={props.title} />;

  // TODO: Instead of using `ChartContainer`, enforce the height from the parent layout
  if (props.isLoading) {
    return (
      <ChartContainer>
        <Widget
          Title={Title}
          Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        />
      </ChartContainer>
    );
  }

  if (props.error) {
    return (
      <ChartContainer>
        <Widget
          Title={Title}
          Visualization={<Widget.WidgetError error={props.error} />}
        />
      </ChartContainer>
    );
  }

  if (visualizationProps.timeSeries.length === 0) {
    return (
      <ChartContainer>
        <Widget
          Title={Title}
          Visualization={<Widget.WidgetError error={MISSING_DATA_MESSAGE} />}
        />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <Widget
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization {...visualizationProps} />}
        Actions={
          <Widget.WidgetToolbar>
            <Button
              size="xs"
              aria-label={t('Open Full-Screen View')}
              borderless
              icon={<IconExpand />}
              onClick={() => {
                openInsightChartModal({
                  title: props.title,
                  children: (
                    <ReleaseSeries
                      start={start}
                      end={end}
                      queryExtra={undefined}
                      period={period}
                      utc={utc}
                      projects={projects}
                      environments={environments}
                    >
                      {({releases}) => {
                        return (
                          <ModalChartContainer>
                            <TimeSeriesWidgetVisualization
                              {...visualizationProps}
                              releases={
                                releases
                                  ? releases.map(release => ({
                                      timestamp: release.date,
                                      version: release.version,
                                    }))
                                  : []
                              }
                            />
                          </ModalChartContainer>
                        );
                      }}
                    </ReleaseSeries>
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

const COMMON_COLORS: Record<string, string> = {
  'spm()': THROUGHPUT_COLOR,
  'count()': COUNT_COLOR,
  'avg(span.self_time)': AVG_COLOR,
  'http_response_rate(3)': HTTP_RESPONSE_3XX_COLOR,
  'http_response_rate(4)': HTTP_RESPONSE_4XX_COLOR,
  'http_response_rate(5)': HTTP_RESPONSE_5XX_COLOR,
  'avg(messaging.message.receive.latency)': CHART_PALETTE[2][1],
  'avg(span.duration)': CHART_PALETTE[2][2],
};

const ChartContainer = styled('div')`
  height: 220px;
`;

const ModalChartContainer = styled('div')`
  height: 360px;
`;

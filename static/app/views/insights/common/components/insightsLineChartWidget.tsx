import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Aliases} from 'sentry/views/dashboards/widgets/common/types';
import {
  LineChartWidget,
  type LineChartWidgetProps,
} from 'sentry/views/dashboards/widgets/lineChartWidget/lineChartWidget';
import {LineChartWidgetSeries} from 'sentry/views/dashboards/widgets/lineChartWidget/lineChartWidgetSeries';
import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

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

interface InsightsLineChartWidgetProps
  extends Pick<LineChartWidgetProps, 'title' | 'isLoading'> {
  error: LineChartWidgetProps['error'] | null;
  series: DiscoverSeries[];
  aliases?: Aliases;
}

export function InsightsLineChartWidget(props: InsightsLineChartWidgetProps) {
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const {projects, environments} = pageFilters.selection;

  const visualizationProps: TimeSeriesWidgetVisualizationProps = {
    SeriesConstructor: LineChartWidgetSeries,
    timeseries: (props.series.filter(Boolean) ?? [])?.map(serie => {
      const timeserie = convertSeriesToTimeseries(serie);

      return {
        ...timeserie,
        color: serie.color ?? COMMON_COLORS[timeserie.field],
      };
    }),
    aliases: props.aliases,
    dataCompletenessDelay: 90,
  };

  return (
    <ChartContainer>
      <LineChartWidget
        title={props.title}
        isLoading={props.isLoading}
        error={props.error ?? undefined}
        {...visualizationProps}
        onFullScreenViewClick={() => {
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
                        aliases={props.aliases}
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
};

const ChartContainer = styled('div')`
  height: 220px;
`;

const ModalChartContainer = styled('div')`
  height: 360px;
`;

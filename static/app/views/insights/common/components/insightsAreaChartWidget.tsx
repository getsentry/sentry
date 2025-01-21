import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  AreaChartWidget,
  type AreaChartWidgetProps,
} from 'sentry/views/dashboards/widgets/areaChartWidget/areaChartWidget';
import {
  AreaChartWidgetVisualization,
  type AreaChartWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/areaChartWidget/areaChartWidgetVisualization';
import type {Aliases} from 'sentry/views/dashboards/widgets/common/types';

import {THROUGHPUT_COLOR} from '../../colors';
import type {DiscoverSeries} from '../queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from '../utils/convertSeriesToTimeseries';

interface InsightsAreaChartWidgetProps
  extends Pick<AreaChartWidgetProps, 'title' | 'isLoading'> {
  aliases: Aliases;
  error: AreaChartWidgetProps['error'] | null;
  series: DiscoverSeries[];
}

export function InsightsAreaChartWidget(props: InsightsAreaChartWidgetProps) {
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const {projects, environments} = pageFilters.selection;

  const visualizationProps: AreaChartWidgetVisualizationProps = {
    timeseries: (props.series.filter(Boolean) ?? [])?.map(serie => {
      const timeserie = convertSeriesToTimeseries(serie);

      return {
        ...timeserie,
        color: serie.color ?? COMMON_COLORS[timeserie.field],
      };
    }),
    aliases: props.aliases,
  };

  return (
    <ChartContainer>
      <AreaChartWidget
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
                      <AreaChartWidgetVisualization
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
    </ChartContainer>
  );
}

const COMMON_COLORS: Record<string, string> = {
  'spm()': THROUGHPUT_COLOR,
  'avg(messaging.message.receive.latency)': CHART_PALETTE[2][1],
  'avg(span.duration)': CHART_PALETTE[2][2],
};

const ChartContainer = styled('div')`
  height: 220px;
`;

const ModalChartContainer = styled('div')`
  height: 360px;
`;

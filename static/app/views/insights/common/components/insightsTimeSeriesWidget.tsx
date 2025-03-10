import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {Aliases} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
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
import {INGESTION_DELAY} from '../../settings';
import type {DiscoverSeries} from '../queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from '../utils/convertSeriesToTimeseries';

export interface InsightsTimeSeriesWidgetProps {
  error: Error | null;
  isLoading: boolean;
  series: DiscoverSeries[];
  title: string;
  visualizationType: 'line' | 'area' | 'bar';
  aliases?: Aliases;
  stacked?: boolean;
}

export function InsightsTimeSeriesWidget(props: InsightsTimeSeriesWidgetProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  const visualizationProps: TimeSeriesWidgetVisualizationProps = {
    plottables: (props.series.filter(Boolean) ?? [])?.map(serie => {
      const timeSeries = convertSeriesToTimeseries(serie);
      const PlottableDataConstructor =
        props.visualizationType === 'line'
          ? Line
          : props.visualizationType === 'area'
            ? Area
            : Bars;

      return new PlottableDataConstructor(timeSeries, {
        color: serie.color ?? COMMON_COLORS[timeSeries.field],
        delay: INGESTION_DELAY,
        stack: props.stacked && props.visualizationType === 'bar' ? 'all' : undefined,
      });
    }),
    aliases: props.aliases,
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

  if (props.series.filter(Boolean).length === 0) {
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
        Visualization={
          <TimeSeriesWidgetVisualization
            {...(organization.features.includes('release-bubbles-ui')
              ? {releases, showReleaseAs: 'bubble'}
              : {})}
            {...visualizationProps}
          />
        }
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
                    <ModalChartContainer>
                      <TimeSeriesWidgetVisualization
                        {...visualizationProps}
                        releases={releases ?? []}
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

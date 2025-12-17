import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {BarChart} from 'sentry/components/charts/barChart';
import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {ChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {
  ChartContainer,
  ModalChartContainer,
} from 'sentry/views/insights/common/components/insightsChartContainer';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import {Referrer} from 'sentry/views/insights/mobile/screenload/referrers';
import {transformDeviceClassEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {SpanFields, type SpanProperty} from 'sentry/views/insights/types';

export function ScreensBarChart({
  chartHeight,
  chartProps,
  search,
  type,
}: {
  search: MutableSearch;
  type: 'ttid' | 'ttfd';
  chartHeight?: number;
  chartProps?: BaseChartProps;
}) {
  const theme = useTheme();
  const {isLoading: isReleasesLoading, primaryRelease} = useReleaseSelection();

  const groupBy: SpanProperty[] = [SpanFields.DEVICE_CLASS];
  if (defined(primaryRelease)) {
    groupBy.push(SpanFields.RELEASE);
  }
  const breakdownMetric: SpanProperty =
    type === 'ttid'
      ? 'avg(measurements.time_to_initial_display)'
      : 'avg(measurements.time_to_full_display)';
  groupBy.push(breakdownMetric);

  const referrer = Referrer.SCREEN_BAR_CHART;

  const {
    data: deviceClassEvents,
    isPending,
    error,
  } = useSpans(
    {
      enabled: !isReleasesLoading,
      search,
      orderby: breakdownMetric,
      fields: groupBy,
    },
    referrer
  );

  const transformedEvents = transformDeviceClassEvents({
    yAxes: [type === 'ttid' ? YAxis.TTID : YAxis.TTFD],
    primaryRelease,
    data: deviceClassEvents,
    theme,
  });

  const title = type === 'ttid' ? t('TTID by Device Class') : t('TTFD by Device Class');

  const Title = <Widget.WidgetTitle title={title} />;

  if (isPending || isReleasesLoading) {
    return (
      <ChartContainer height={chartHeight}>
        <Widget
          Title={Title}
          Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        />
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer height={chartHeight}>
        <Widget Title={Title} Visualization={<Widget.WidgetError error={error} />} />
      </ChartContainer>
    );
  }

  const series = Object.values(
    transformedEvents[YAXIS_COLUMNS[type === 'ttid' ? YAxis.TTID : YAxis.TTFD]]!
  )?.map(s => ({
    ...s,
    name: formatVersion(s.seriesName),
  }));

  const Visualization = (
    <BarChart
      {...chartProps}
      autoHeightResize
      series={series}
      grid={{
        left: '0',
        right: '0',
        top: 25,
        bottom: '0',
        containLabel: true,
      }}
      xAxis={{
        type: 'category',
        axisTick: {show: true},
        data: [t('high'), t('medium'), t('low'), t('Unknown')],
        truncate: 14,
        axisLabel: {
          interval: 0,
        },
      }}
      legend={{show: primaryRelease !== undefined, top: 0, left: 0}}
      yAxis={{
        axisLabel: {
          formatter(value: number) {
            return axisLabelFormatter(
              value,
              aggregateOutputType(breakdownMetric),
              undefined,
              getDurationUnit(series ?? [])
            );
          },
        },
      }}
      tooltip={{
        valueFormatter: (value, _seriesName) => {
          return tooltipFormatter(value, aggregateOutputType(breakdownMetric));
        },
      }}
    />
  );

  return (
    <ChartContainer height={chartHeight}>
      <Widget
        Title={Title}
        Visualization={Visualization}
        Actions={
          <Widget.WidgetToolbar>
            <ChartActionDropdown
              chartType={ChartType.LINE}
              yAxes={[breakdownMetric]}
              groupBy={[...groupBy] as SpanFields[]}
              title={title}
              search={search}
              referrer={referrer}
            />
            <Button
              size="xs"
              aria-label={t('Open Full-Screen View')}
              borderless
              icon={<IconExpand />}
              onClick={() => {
                openInsightChartModal({
                  title: Title,
                  children: <ModalChartContainer>{Visualization}</ModalChartContainer>,
                });
              }}
            />
          </Widget.WidgetToolbar>
        }
      />
    </ChartContainer>
  );
}

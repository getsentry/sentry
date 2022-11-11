import type {LineSeriesOption} from 'echarts';

import {BarChart} from 'sentry/components/charts/barChart';
import {getYAxisMaxFn} from 'sentry/components/charts/miniBarChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import EmptyMessage from 'sentry/components/emptyMessage';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {SeriesDataUnit} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import theme from 'sentry/utils/theme';
import useApiRequests from 'sentry/utils/useApiRequests';

import {Monitor, MonitorStat} from './types';

type Props = {
  monitor: Monitor;
};

type State = {
  stats: MonitorStat[] | null;
};

const MonitorStats = ({monitor}: Props) => {
  const until = Math.floor(new Date().getTime() / 1000);
  const since = until - 3600 * 24 * 30;
  const {data, renderComponent} = useApiRequests<State>({
    endpoints: [
      [
        'stats',
        `/monitors/${monitor.id}/stats/`,
        {
          query: {
            since: since.toString(),
            until: until.toString(),
            resolution: '1d',
          },
        },
      ],
    ],
  });

  let emptyStats = true;
  const success = {
    seriesName: t('Successful'),
    yAxisIndex: 0,
    data: [] as SeriesDataUnit[],
  };
  const failed = {
    seriesName: t('Failed'),
    yAxisIndex: 0,
    data: [] as SeriesDataUnit[],
  };
  const missed = {
    seriesName: t('Missed'),
    yAxisIndex: 0,
    data: [] as SeriesDataUnit[],
  };
  const durationData = [] as [number, number][];

  data.stats?.forEach(p => {
    if (p.ok || p.error || p.missed) {
      emptyStats = false;
    }
    const timestamp = p.ts * 1000;
    success.data.push({name: timestamp, value: p.ok});
    failed.data.push({name: timestamp, value: p.error});
    missed.data.push({name: timestamp, value: p.missed});
    durationData.push([timestamp, Math.trunc(p.duration)]);
  });
  const colors = [theme.green200, theme.red200, theme.yellow200];

  const durationTitle = t('Average Duration');
  const additionalSeries: LineSeriesOption[] = [
    LineSeries({
      name: durationTitle,
      data: durationData,
      lineStyle: {color: theme.purple300, width: 2},
      itemStyle: {color: theme.purple300},
      yAxisIndex: 1,
      animation: false,
    }),
  ];

  const height = 150;
  const getYAxisOptions = (aggregateType: AggregationOutputType) => ({
    max: getYAxisMaxFn(height),
    splitLine: {
      show: false,
    },
    axisLabel: {
      formatter: (value: number) => axisLabelFormatter(value, aggregateType, true),
      showMaxLabel: false,
    },
  });

  return renderComponent(
    <Panel>
      <PanelBody withPadding>
        {!emptyStats ? (
          <BarChart
            isGroupedByDate
            showTimeInTooltip
            series={[success, failed, missed]}
            stacked
            additionalSeries={additionalSeries}
            height={height}
            colors={colors}
            tooltip={{
              trigger: 'axis',
              valueFormatter: (value: number, label?: string) => {
                return label === durationTitle
                  ? tooltipFormatter(value, 'duration')
                  : tooltipFormatter(value, 'number');
              },
            }}
            yAxes={[{...getYAxisOptions('number')}, {...getYAxisOptions('duration')}]}
            grid={{
              top: 6,
              bottom: 0,
              left: 4,
              right: 0,
            }}
            animation={false}
          />
        ) : (
          <EmptyMessage
            title={t('Nothing recorded in the last 30 days.')}
            description={t('All check-ins for this monitor.')}
          />
        )}
      </PanelBody>
    </Panel>
  );
};

export default MonitorStats;

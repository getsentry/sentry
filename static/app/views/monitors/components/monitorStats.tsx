import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import type {BarChartSeries} from 'sentry/components/charts/barChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {getYAxisMaxFn} from 'sentry/components/charts/miniBarChart';
import {HeaderTitle} from 'sentry/components/charts/styles';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useApiQuery} from 'sentry/utils/queryClient';
import theme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {Monitor, MonitorEnvironment, MonitorStat} from '../types';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
  orgSlug: string;
};

export function MonitorStats({monitor, monitorEnvs, orgSlug}: Props) {
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;

  const nowRef = useRef(new Date());

  let since: number, until: number;
  if (start && end) {
    until = new Date(end).getTime() / 1000;
    since = new Date(start).getTime() / 1000;
  } else {
    until = Math.floor(nowRef.current.getTime() / 1000);
    const intervalSeconds = intervalToMilliseconds(period ?? '30d') / 1000;
    since = until - intervalSeconds;
  }

  const queryKey = [
    `/projects/${orgSlug}/${monitor.project.slug}/monitors/${monitor.slug}/stats/`,
    {
      query: {
        since: since.toString(),
        until: until.toString(),
        resolution: '1d',
        environment: monitorEnvs.map(e => e.name),
      },
    },
  ] as const;

  const {data: stats, isPending} = useApiQuery<MonitorStat[]>(queryKey, {staleTime: 0});

  let emptyStats = true;
  const success: BarChartSeries = {
    seriesName: t('Successful'),
    data: [],
  };
  const failed: BarChartSeries = {
    seriesName: t('Failed'),
    data: [],
  };
  const missed: BarChartSeries = {
    seriesName: t('Missed'),
    data: [],
  };
  const timeout: BarChartSeries = {
    seriesName: t('Timeout'),
    data: [],
  };
  const duration: AreaChartSeries = {
    seriesName: t('Average Duration'),
    data: [],
  };

  stats?.forEach(p => {
    if (p.ok || p.error || p.missed || p.timeout) {
      emptyStats = false;
    }
    const timestamp = p.ts * 1000;
    success.data.push({name: timestamp, value: p.ok});
    failed.data.push({name: timestamp, value: p.error});
    timeout.data.push({name: timestamp, value: p.timeout});
    missed.data.push({name: timestamp, value: p.missed});
    duration.data.push({name: timestamp, value: Math.trunc(p.duration)});
  });
  const colors = [theme.green200, theme.red200, theme.red200, theme.yellow200];

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

  if (!isPending && emptyStats) {
    return (
      <Panel>
        <PanelBody withPadding>
          <EmptyMessage
            title={t('No check-ins have been recorded for this time period.')}
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Fragment>
      <Panel>
        <PanelBody withPadding>
          <StyledHeaderTitle>{t('Status')}</StyledHeaderTitle>
          {isPending ? (
            <Placeholder height={`${height}px`} />
          ) : (
            <BarChart
              isGroupedByDate
              showTimeInTooltip
              useShortDate
              series={[success, failed, timeout, missed]}
              stacked
              height={height}
              colors={colors}
              tooltip={{
                trigger: 'axis',
              }}
              yAxis={getYAxisOptions('number')}
              grid={{
                top: 6,
                bottom: 0,
                left: 0,
                right: 0,
              }}
              animation={false}
            />
          )}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelBody withPadding>
          <StyledHeaderTitle>{t('Average Duration')}</StyledHeaderTitle>
          {isPending ? (
            <Placeholder height={`${height}px`} />
          ) : (
            <AreaChart
              isGroupedByDate
              showTimeInTooltip
              useShortDate
              series={[duration]}
              height={height}
              colors={[theme.charts.colors![0]!]}
              yAxis={getYAxisOptions('duration')}
              grid={{
                top: 6,
                bottom: 0,
                left: 0,
                right: 0,
              }}
              tooltip={{
                valueFormatter: value => tooltipFormatter(value, 'duration'),
              }}
            />
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const StyledHeaderTitle = styled(HeaderTitle)`
  margin-bottom: ${space(1)};
`;

export default MonitorStats;

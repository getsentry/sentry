import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

function createSeriesAndCount(stats: EventsStats) {
  return stats?.data?.reduce(
    (result, [timestamp, countData]) => {
      const count = countData?.[0]?.count ?? 0;
      return {
        series: [
          ...result.series,
          {
            name: timestamp * 1000, // ms -> s
            value: count,
          },
        ],
        count: result.count + count,
      };
    },
    {series: [] as SeriesDataUnit[], count: 0}
  );
}

export function EventGraph({groupStats}: {groupStats: MultiSeriesEventsStats}) {
  const [visibleSeries, setVisibleSeries] = useState({user: true, event: true});
  const eventStats = groupStats['count()'];
  const {series: eventSeries, count: eventCount} = useMemo(
    () => createSeriesAndCount(eventStats),
    [eventStats]
  );
  const userStats = groupStats['count_unique(user)'];
  const {series: userSeries, count: userCount} = useMemo(
    () => createSeriesAndCount(userStats),
    [userStats]
  );
  const series: BarChartSeries[] = [];

  if (eventStats && visibleSeries.user) {
    series.push({
      seriesName: t('Users'),
      itemStyle: {
        borderRadius: visibleSeries.event ? 0 : [2, 2, 0, 0],
        borderColor: theme.translucentGray200,
        color: theme.purple200,
      },
      stack: 'stats',
      data: userSeries,
    });
  }
  if (eventStats && visibleSeries.event) {
    series.push({
      seriesName: t('Events'),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        borderColor: theme.translucentGray200,
        color: theme.gray200,
      },
      stack: 'stats',
      data: eventSeries,
    });
  }

  return (
    <GraphWrapper>
      <SummaryContainer>
        <Callout
          onClick={() =>
            visibleSeries.user &&
            setVisibleSeries({...visibleSeries, event: !visibleSeries.event})
          }
          enabled={visibleSeries.event}
          disabled={!visibleSeries.user}
        >
          <InteractionStateLayer hidden={!visibleSeries.user} />
          <Label>{tn('Event', 'Events', eventCount)}</Label>
          <Count>{formatAbbreviatedNumber(eventCount)}</Count>
        </Callout>
        <Callout
          onClick={() =>
            visibleSeries.event &&
            setVisibleSeries({...visibleSeries, user: !visibleSeries.user})
          }
          enabled={visibleSeries.user}
          disabled={!visibleSeries.event}
        >
          <InteractionStateLayer hidden={!visibleSeries.event} />
          <Label>{tn('User', 'Users', userCount)}</Label>
          <Count>{formatAbbreviatedNumber(userCount)}</Count>
        </Callout>
      </SummaryContainer>
      <ChartContainer role="figure">
        <BarChart
          height={80}
          series={series}
          isGroupedByDate
          showTimeInTooltip
          grid={{
            top: 8,
            left: 8,
            right: 8,
            bottom: 0,
          }}
          yAxis={{
            splitNumber: 2,
            axisLabel: {
              formatter: value => formatAbbreviatedNumber(value),
            },
          }}
        />
      </ChartContainer>
    </GraphWrapper>
  );
}

const SummaryContainer = styled('div')`
  display: grid;
  grid-template-rows: 1fr 1fr;
  align-items: center;
  gap: ${space(1.5)};
  padding: 0 ${space(1)};
  border-right: 1px solid ${p => p.theme.border};
  margin-right: space(1);
`;

const Callout = styled('button')<{disabled: boolean; enabled: boolean}>`
  cursor: ${p => (p.disabled ? 'initial' : 'pointer')};
  opacity: ${p => (p.enabled ? 1 : 0.5)};
  user-select: none;
  background: ${p => p.theme.background};
  outline: 0;
  border: 0;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  padding: ${space(0.25)} ${space(0.5)};
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1;
`;

const Count = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin-top: ${space(0.5)};
  line-height: 1;
`;

const ChartContainer = styled('div')`
  height: 80px;
`;

const GraphWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
`;

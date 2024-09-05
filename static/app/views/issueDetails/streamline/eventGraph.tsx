import styled from '@emotion/styled';

import {BarChart, type BarChartSeries} from 'sentry/components/charts/barChart';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TimeseriesValue} from 'sentry/types/core';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import theme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';

export function EventGraph({group, groupStats}: {group: Group; groupStats?: any}) {
  const {selection} = usePageFilters();
  const {environments} = selection;
  const series: BarChartSeries[] = [];
  const stats: TimeseriesValue[] = groupStats
    ? groupStats.eventStats
    : group?.stats?.custom ?? group?.stats['30d'];

  const {data, eventCount} = stats.reduce(
    (result, [timestamp, count]) => {
      return {
        data: [
          ...result.data,
          {
            name: timestamp * 1000, // ms -> s
            value: count,
          },
        ],
        eventCount: result.eventCount + count,
      };
    },
    {data: [] as SeriesDataUnit[], eventCount: 0}
  );

  if (environments) {
    series.push({
      seriesName: t('Events'),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        borderColor: theme.translucentGray200,
        color: theme.gray200,
      },
      data,
    });
  }

  return (
    <GraphWrapper>
      <SummaryContainer>
        <div>
          <Label>{tn('Event', 'Events', eventCount)}</Label>
          <Count>{eventCount}</Count>
        </div>
        {defined(groupStats?.userCount) && (
          <div>
            <Label>{tn('User', 'Users', groupStats.userCount)}</Label>
            <Count>{groupStats.userCount}</Count>
          </div>
        )}
      </SummaryContainer>
      <ChartContainer>
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

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1;
`;

const Count = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: 1;
`;

const ChartContainer = styled('div')`
  height: 80px;
`;

const GraphWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
`;

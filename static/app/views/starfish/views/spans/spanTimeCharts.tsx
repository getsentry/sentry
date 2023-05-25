import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {getSpanTotalTimeChartQuery} from 'sentry/views/starfish/views/spans/queries';

type Props = {
  descriptionFilter: string;
  queryConditions: string[];
};

export function SpanTimeCharts({descriptionFilter, queryConditions}: Props) {
  const themes = useTheme();
  const location = useLocation();

  const pageFilter = usePageFilters();
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const {isLoading, data} = useSpansQuery<
    {interval: string; p50: number; spm: number; total_time: number}[]
  >({
    queryString: `${getSpanTotalTimeChartQuery(
      pageFilter.selection.datetime,
      descriptionFilter,
      queryConditions
    )}&referrer=span-time-charts`,
    initialData: [],
  });

  const {span_operation, action, domain} = location.query;

  const label = getSegmentLabel(span_operation, action, domain);
  const dataByGroup = {[label]: data};

  const throughputTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'Throughput',
        data: groupData.map(datum => ({
          value: datum.spm,
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
  });

  const totalTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'Total Time',
        data: groupData.map(datum => ({
          value: datum.total_time,
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
  });

  const p50Series = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'p50()',
        data: groupData.map(datum => ({
          value: datum.p50,
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
  });

  useSynchronizeCharts([!isLoading]);

  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <ChartPanel title={t('Total Time')}>
          <Chart
            statsPeriod="24h"
            height={100}
            data={totalTimeSeries}
            start=""
            end=""
            loading={isLoading}
            utc={false}
            grid={{
              left: '0',
              right: '0',
              top: '8px',
              bottom: '0',
            }}
            definedAxisTicks={4}
            stacked
            chartColors={themes.charts.getColorPalette(2)}
            disableXAxis
          />
        </ChartPanel>
      </ChartsContainerItem>

      <ChartsContainerItem>
        <ChartPanel title={t('Throughput (SPM)')}>
          <Chart
            statsPeriod="24h"
            height={100}
            data={throughputTimeSeries}
            start=""
            end=""
            loading={isLoading}
            utc={false}
            grid={{
              left: '0',
              right: '0',
              top: '8px',
              bottom: '0',
            }}
            definedAxisTicks={4}
            stacked
            isLineChart
            chartColors={themes.charts.getColorPalette(2)}
            disableXAxis
            tooltipFormatterOptions={{
              valueFormatter: value => `${value.toFixed(3)} / ${t('min')}`,
            }}
          />
        </ChartPanel>
      </ChartsContainerItem>

      <ChartsContainerItem>
        <ChartPanel title={t('p50')}>
          <Chart
            statsPeriod="24h"
            height={100}
            data={p50Series}
            start=""
            end=""
            loading={isLoading}
            utc={false}
            grid={{
              left: '0',
              right: '0',
              top: '8px',
              bottom: '0',
            }}
            definedAxisTicks={4}
            stacked
            isLineChart
            chartColors={themes.charts.getColorPalette(2)}
            disableXAxis
          />
        </ChartPanel>
      </ChartsContainerItem>
    </ChartsContainer>
  );
}

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;

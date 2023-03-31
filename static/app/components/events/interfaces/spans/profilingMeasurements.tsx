import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import {
  MINIMAP_HEIGHT,
  PROFILE_MEASUREMENTS_CHART_HEIGHT,
  TIME_AXIS_HEIGHT,
} from 'sentry/components/events/interfaces/spans/constants';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import {
  OpsDot,
  OpsLine,
  OpsName,
  OpsNameContainer,
} from 'sentry/components/events/opsBreakdown';
import {DividerSpacer} from 'sentry/components/performance/waterfall/miniHeader';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';

const NS_PER_MS = 1000000;

function toMilliseconds(nanoseconds: number) {
  return nanoseconds / NS_PER_MS;
}

type ChartProps = {
  data: {
    unit: string;
    values: Profiling.MeasurementValue[];
  };
};

function Chart({data}: ChartProps) {
  const theme = useTheme();
  const series: LineChartSeries[] = [
    {
      seriesName: 'CPU Usage',
      // Use uniqBy since we can't guarantee the interval between recordings and
      // we're converting to lower fidelity (ns -> ms). This can result in duplicate entries
      data: uniqBy<SeriesDataUnit>(
        data.values.map(value => {
          return {
            name: toMilliseconds(value.elapsed_since_start_ns).toFixed(0),
            value: value.value,
          };
        }),
        'name'
      ),
      yAxisIndex: 0,
      xAxisIndex: 0,
    },
  ];

  return (
    <LineChart
      data-test-id="profile-measurements-chart"
      height={PROFILE_MEASUREMENTS_CHART_HEIGHT}
      yAxis={{
        show: false,
        axisLabel: {show: false},
        axisTick: {show: false},
      }}
      xAxis={{
        show: false,
        axisLabel: {show: false},
        axisTick: {show: false},
        axisPointer: {
          lineStyle: {
            color: theme.red300,
            width: 2,
            opacity: 0.5,
          },
        },
      }}
      series={series}
      renderer="svg"
      grid={{
        left: 0,
        top: 0,
        right: 0,
        bottom: 1,
      }}
      seriesOptions={{
        showSymbol: false,
      }}
      colors={[theme.green200] as string[]}
      tooltip={{
        valueFormatter: (value, _seriesName) => {
          return `${value.toFixed(2)}%`;
        },
      }}
    />
  );
}

type ProfilingMeasurementsProps = {
  profileData: Profiling.ProfileInput;
};

function ProfilingMeasurements({profileData}: ProfilingMeasurementsProps) {
  const theme = useTheme();

  if (!('measurements' in profileData) || !defined(profileData.measurements?.cpu_usage)) {
    return null;
  }

  const cpuUsageData = profileData.measurements!.cpu_usage!;

  return (
    <DividerHandlerManager.Consumer>
      {dividerHandlerChildrenProps => {
        const {dividerPosition} = dividerHandlerChildrenProps;
        return (
          <MeasurementContainer>
            <ChartOpsLabel dividerPosition={dividerPosition}>
              <OpsLine>
                <OpsNameContainer>
                  <OpsDot style={{backgroundColor: theme.green200}} />
                  <OpsName>{t('CPU Usage')}</OpsName>
                </OpsNameContainer>
              </OpsLine>
            </ChartOpsLabel>
            <DividerSpacer />
            <ChartContainer>
              <Chart data={cpuUsageData} />;
            </ChartContainer>
          </MeasurementContainer>
        );
      }}
    </DividerHandlerManager.Consumer>
  );
}

export {ProfilingMeasurements};

const ChartContainer = styled('div')`
  flex: 1;
  border-top: 1px solid ${p => p.theme.border};
`;

const ChartOpsLabel = styled('div')<{dividerPosition: number}>`
  width: calc(${p => toPercent(p.dividerPosition)} - 0.5px);
  height: 100%;
  padding-left: ${space(3)};
`;

const MeasurementContainer = styled('div')`
  display: flex;
  position: absolute;
  width: 100%;
  top: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px;
`;

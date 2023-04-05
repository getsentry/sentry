import React from 'react';
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

import * as CursorGuideHandler from './cursorGuideHandler';

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
      seriesName: t('CPU Usage'),
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
          type: 'none',
          triggerOn: 'mousemove',
        },
        boundaryGap: false,
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

// Memoized to prevent re-rendering when the cursor guide is displayed
const MemoizedChart = React.memo(Chart);

type ProfilingMeasurementsProps = {
  profileData: Profiling.ProfileInput;
  renderCursorGuide?: ({
    cursorGuideHeight,
    mouseLeft,
    showCursorGuide,
  }: {
    cursorGuideHeight: number;
    mouseLeft: number | undefined;
    showCursorGuide: boolean;
  }) => void;
  renderFog?: () => void;
  renderWindowSelection?: () => void;
};

function ProfilingMeasurements({
  profileData,
  renderCursorGuide,
  renderFog,
  renderWindowSelection,
}: ProfilingMeasurementsProps) {
  const theme = useTheme();

  if (!('measurements' in profileData) || !defined(profileData.measurements?.cpu_usage)) {
    return null;
  }

  const cpuUsageData = profileData.measurements!.cpu_usage!;

  return (
    <CursorGuideHandler.Consumer>
      {({displayCursorGuide, hideCursorGuide, mouseLeft, showCursorGuide}) => (
        <DividerHandlerManager.Consumer>
          {({dividerPosition}) => (
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
              <ChartContainer
                onMouseEnter={event => {
                  displayCursorGuide(event.pageX);
                }}
                onMouseLeave={() => {
                  hideCursorGuide();
                }}
                onMouseMove={event => {
                  displayCursorGuide(event.pageX);
                }}
              >
                <MemoizedChart data={cpuUsageData} />
                <Overlays>
                  {renderFog?.()}
                  {renderCursorGuide?.({
                    showCursorGuide,
                    mouseLeft,
                    cursorGuideHeight: PROFILE_MEASUREMENTS_CHART_HEIGHT,
                  })}
                  {renderWindowSelection?.()}
                </Overlays>
              </ChartContainer>
            </MeasurementContainer>
          )}
        </DividerHandlerManager.Consumer>
      )}
    </CursorGuideHandler.Consumer>
  );
}

export {ProfilingMeasurements};

const Overlays = styled('div')`
  pointer-events: none;
  position: absolute;
  top: 0;
  height: 100%;
  width: 100%;
`;

const ChartContainer = styled('div')`
  position: relative;
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

import React, {useState} from 'react';
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
import {OpsLine} from 'sentry/components/events/opsBreakdown';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {DividerSpacer} from 'sentry/components/performance/waterfall/miniHeader';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SeriesDataUnit} from 'sentry/types/echarts';
import {formatBytesBase10} from 'sentry/utils';

import * as CursorGuideHandler from './cursorGuideHandler';

const NS_PER_MS = 1000000;
const CPU_USAGE = 'cpu_usage';
const MEMORY = 'memory_footprint';

function toMilliseconds(nanoseconds: number) {
  return nanoseconds / NS_PER_MS;
}

function getChartName(op: string) {
  switch (op) {
    case CPU_USAGE:
      return t('CPU Usage');
    case MEMORY:
      return t('Memory');
    default:
      return '';
  }
}

type ChartProps = {
  data: {
    unit: string;
    values: Profiling.MeasurementValue[];
  };
  type: typeof CPU_USAGE | typeof MEMORY;
};

function Chart({data, type}: ChartProps) {
  const theme = useTheme();
  const series: LineChartSeries[] = [
    {
      seriesName: getChartName(type),
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
      data-test-id={`profile-measurements-chart-${type}`}
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
      colors={[theme.red300] as string[]}
      tooltip={{
        valueFormatter: (value, _seriesName) => {
          if (type === CPU_USAGE) {
            return `${value.toFixed(2)}%`;
          }

          return formatBytesBase10(value);
        },
      }}
    />
  );
}

// Memoized to prevent re-rendering when the cursor guide is displayed
const MemoizedChart = React.memo(
  Chart,
  (prevProps, nextProps) => prevProps.type === nextProps.type
);

type ProfilingMeasurementsProps = {
  profileData: Profiling.ProfileInput;
  onStartWindowSelection?: (event: React.MouseEvent<HTMLDivElement>) => void;
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
  onStartWindowSelection,
  renderCursorGuide,
  renderFog,
  renderWindowSelection,
}: ProfilingMeasurementsProps) {
  const [measurementType, setMeasurementType] = useState<
    typeof CPU_USAGE | typeof MEMORY
  >(CPU_USAGE);

  if (
    !('measurements' in profileData) ||
    profileData.measurements?.[measurementType] === undefined
  ) {
    return null;
  }

  const data = profileData.measurements[measurementType]!;

  return (
    <CursorGuideHandler.Consumer>
      {({displayCursorGuide, hideCursorGuide, mouseLeft, showCursorGuide}) => (
        <DividerHandlerManager.Consumer>
          {({dividerPosition}) => (
            <MeasurementContainer>
              <ChartOpsLabel dividerPosition={dividerPosition}>
                <OpsLine>
                  <RadioGroup
                    style={{overflowX: 'visible'}}
                    choices={[
                      [CPU_USAGE, getChartName(CPU_USAGE)],
                      [MEMORY, getChartName(MEMORY)],
                    ]}
                    value={measurementType}
                    label={t('Profile Measurements Chart Type')}
                    onChange={type => {
                      setMeasurementType(type);
                    }}
                  />
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
                onMouseDown={onStartWindowSelection}
              >
                <MemoizedChart data={data} type={measurementType} />
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
`;

const ChartOpsLabel = styled('div')<{dividerPosition: number}>`
  display: flex;
  align-items: center;
  width: calc(${p => toPercent(p.dividerPosition)} - 0.5px);
  height: ${PROFILE_MEASUREMENTS_CHART_HEIGHT + TIME_AXIS_HEIGHT}px;
  padding-left: ${space(3)};
`;

const MeasurementContainer = styled('div')`
  display: flex;
  position: absolute;
  width: 100%;
  top: ${MINIMAP_HEIGHT}px;
  border-top: 1px solid ${p => p.theme.border};
`;

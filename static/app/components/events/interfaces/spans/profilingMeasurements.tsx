import {memo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {
  MINIMAP_HEIGHT,
  PROFILE_MEASUREMENTS_CHART_HEIGHT,
  TIME_AXIS_HEIGHT,
} from 'sentry/components/events/interfaces/spans/constants';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import {OpsLine} from 'sentry/components/events/opsBreakdown';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {DividerSpacer} from 'sentry/components/performance/waterfall/miniHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import toPercent from 'sentry/utils/number/toPercent';

import * as CursorGuideHandler from './cursorGuideHandler';

export const MIN_DATA_POINTS = 3;
export const MS_PER_S = 1000;
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

// Filters out data points that are outside of the transaction duration
// because profiles can be longer than the transaction
export function getDataPoints(
  data: {unit: string; values: Profiling.MeasurementValue[]},
  maxDurationInMs: number
) {
  // Use uniqBy since we can't guarantee the interval between recordings and
  // we're converting to lower fidelity (ns -> ms). This can result in duplicate entries
  return uniqBy(
    data.values.map(value => {
      return {
        name: parseFloat(toMilliseconds(value.elapsed_since_start_ns).toFixed(2)),
        value: value.value,
      };
    }),
    'name'
  ).filter(({name}) => name <= maxDurationInMs + 1); // Add 1ms to account for rounding
}

type ChartProps = {
  data: {
    unit: string;
    values: Profiling.MeasurementValue[];
  };
  transactionDuration: number;
  type: typeof CPU_USAGE | typeof MEMORY;
};

function Chart({data, type, transactionDuration}: ChartProps) {
  const theme = useTheme();
  const series: LineChartSeries[] = [
    {
      seriesName: getChartName(type),
      data: getDataPoints(data, transactionDuration),
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
        max: type === CPU_USAGE ? 100 : undefined,
      }}
      xAxis={{
        show: false,
        axisLabel: {show: false},
        axisTick: {show: false},
        axisPointer: {
          type: 'none',
          triggerOn: 'mousemove',
        },
        boundaryGap: [0, 0],
        type: 'value',
        alignTicks: false,
        max: parseFloat(transactionDuration.toFixed(2)),
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
        formatAxisLabel: (value: number) => `${value}ms`,
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
const MemoizedChart = memo(
  Chart,
  (prevProps, nextProps) => prevProps.type === nextProps.type
);

type ProfilingMeasurementsProps = {
  profileData: Profiling.ProfileInput;
  transactionDuration: number;
  onStartWindowSelection?: (event: React.MouseEvent<HTMLDivElement>) => void;
  renderCursorGuide?: ({
    cursorGuideHeight,
    mouseLeft,
    showCursorGuide,
  }: {
    cursorGuideHeight: number;
    mouseLeft: number | undefined;
    showCursorGuide: boolean;
  }) => React.ReactNode;
  renderFog?: () => React.ReactNode;
  renderWindowSelection?: () => React.ReactNode;
};

function ProfilingMeasurements({
  profileData,
  onStartWindowSelection,
  renderCursorGuide,
  renderFog,
  renderWindowSelection,
  transactionDuration,
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

  const data = profileData.measurements[measurementType];
  const transactionDurationInMs = transactionDuration * MS_PER_S;

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
                <MemoizedChart
                  data={data as Profiling.Measurement}
                  type={measurementType}
                  transactionDuration={transactionDurationInMs}
                />
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

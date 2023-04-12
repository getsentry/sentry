import React, {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  MINIMAP_HEIGHT,
  PROFILE_MEASUREMENTS_CHART_HEIGHT,
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
      colors={[theme.green200] as string[]}
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
  const theme = useTheme();
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
                  <OpsNameContainer>
                    <OpsDot style={{backgroundColor: theme.green200}} />
                    <StyledDropdownMenu
                      trigger={triggerProps => (
                        <StyledDropdownButton {...triggerProps} borderless>
                          <OpsName>{getChartName(measurementType)}</OpsName>
                        </StyledDropdownButton>
                      )}
                      items={[
                        {
                          key: CPU_USAGE,
                          label: getChartName(CPU_USAGE),
                          onAction: () => {
                            setMeasurementType(CPU_USAGE);
                          },
                        },
                        {
                          key: MEMORY,
                          label: getChartName(MEMORY),
                          onAction: () => {
                            setMeasurementType(MEMORY);
                          },
                        },
                      ]}
                    />
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
  width: calc(${p => toPercent(p.dividerPosition)} - 0.5px);
  height: 100%;
  padding-left: ${space(3)};
`;

const MeasurementContainer = styled('div')`
  display: flex;
  position: absolute;
  width: 100%;
  top: ${MINIMAP_HEIGHT}px;
  border-top: 1px solid ${p => p.theme.border};
`;

const StyledDropdownButton = styled(DropdownButton)`
  padding: 0;
  padding-right: ${space(0.5)};
  margin-left: 0;
  font-weight: normal;
`;

const StyledDropdownMenu = styled(DropdownMenu)`
  margin-left: 0;
`;

import {useTheme} from '@emotion/react';
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
import {SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';

const CPU_COLOR = '#96C7BA';

// TODO(nar): Types
function CPUChart({cpuData}) {
  const data: LineChartSeries[] = [
    {
      seriesName: 'CPU Usage',
      data: uniqBy<SeriesDataUnit>(
        cpuData.values.map(value => {
          return {
            name: (value.elapsed_since_start_ns / 1000000).toFixed(0),
            value: value.value,
          };
        }),
        'name'
      ),
      yAxisIndex: 0,
      xAxisIndex: 0,
    },
  ];

  const areaChartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    // axisPointer,
    utc: true,
    // isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [CPU_COLOR] as string[],
    tooltip: {
      valueFormatter: (value, _seriesName) => {
        return `${value.toFixed(2)}%`;
      },
    },
  };

  return (
    <LineChart
      height={PROFILE_MEASUREMENTS_CHART_HEIGHT}
      yAxis={{
        show: false,
        axisLabel: {show: false, margin: 0},
      }}
      xAxis={{
        axisPointer: {snap: false},
        show: false,
        axisLabel: {show: false, margin: 0},
      }}
      series={data}
      renderer="svg"
      grid={{
        left: 0,
        top: 0,
        right: 0,
        bottom: 1,
      }}
      {...areaChartProps}
    />
  );
}

function ProfilingMeasurements({profiles}) {
  const theme = useTheme();
  if (!defined(profiles.data?.measurements?.cpu_usage)) {
    return null;
  }

  return (
    <DividerHandlerManager.Consumer>
      {dividerHandlerChildrenProps => {
        const {dividerPosition} = dividerHandlerChildrenProps;
        return (
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              width: '100%',
              top: `${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px`,
            }}
          >
            <div
              style={{
                width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                height: '100%',
                paddingLeft: '20px',
              }}
            >
              <OpsLine>
                <OpsNameContainer>
                  <OpsDot style={{backgroundColor: CPU_COLOR}} />
                  <OpsName>{t('CPU Usage')}</OpsName>
                </OpsNameContainer>
              </OpsLine>
            </div>
            <DividerSpacer />
            <div
              style={{
                borderTop: `1px solid ${theme.gray200}`,
                flex: 1,
              }}
            >
              <CPUChart cpuData={profiles.data.measurements.cpu_usage} />;
            </div>
          </div>
        );
      }}
    </DividerHandlerManager.Consumer>
  );
}

export {ProfilingMeasurements};

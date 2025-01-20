import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {PerformanceLayoutBodyRow} from 'sentry/components/performance/layouts';
import {space} from 'sentry/styles/space';
import type EventView from 'sentry/utils/discover/eventView';
import {usePerformanceDisplayType} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import type {ProjectPerformanceType} from 'sentry/views/performance/utils';

import {getChartSetting} from '../utils';
import type {PerformanceWidgetSetting} from '../widgetDefinitions';

import WidgetContainer from './widgetContainer';

export interface ChartRowProps {
  allowedCharts: PerformanceWidgetSetting[];
  chartCount: number;
  chartHeight: number;
  eventView: EventView;
  location: Location;
  withStaticFilters: boolean;
}

function getInitialChartSettings(
  chartCount: number,
  chartHeight: number,
  performanceType: ProjectPerformanceType,
  allowedCharts: PerformanceWidgetSetting[]
) {
  return new Array(chartCount)
    .fill(0)
    .map((_, index) =>
      getChartSetting(index, chartHeight, performanceType, allowedCharts[index]!)
    );
}

function ChartRow(props: ChartRowProps) {
  const {chartCount, chartHeight, allowedCharts} = props;
  const theme = useTheme();
  const performanceType = usePerformanceDisplayType();
  const palette = theme.charts.getColorPalette(chartCount) ?? [];

  const [chartSettings, setChartSettings] = useState(
    getInitialChartSettings(chartCount, chartHeight, performanceType, allowedCharts)
  );

  if (props.allowedCharts.length < chartCount) {
    throw new Error('Not enough allowed chart types to show row.');
  }

  return (
    <StyledRow minSize={200}>
      {new Array(chartCount).fill(0).map((_, index) => (
        <WidgetContainer
          {...props}
          key={index}
          index={index}
          chartHeight={chartHeight}
          chartColor={palette[index]!}
          defaultChartSetting={allowedCharts[index]!}
          rowChartSettings={chartSettings}
          setRowChartSettings={setChartSettings}
        />
      ))}
    </StyledRow>
  );
}

type DefaultProps = 'chartCount' | 'chartHeight';
type ChartRowPropsWithDefaults = Omit<ChartRowProps, DefaultProps> &
  Pick<Partial<ChartRowProps>, DefaultProps>;

export function TripleChartRow(props: ChartRowPropsWithDefaults) {
  return <ChartRow chartCount={3} chartHeight={100} {...props} />;
}

export function DoubleChartRow(props: ChartRowPropsWithDefaults) {
  return <ChartRow chartCount={2} chartHeight={150} {...props} />;
}

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

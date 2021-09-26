import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';

import {PerformanceLayoutBodyRow} from '../../../layouts';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

import WidgetContainer from './widgetContainer';

export type ChartRowProps = {
  eventView: EventView;
  location: Location;
  allowedCharts: PerformanceWidgetSetting[];
  chartHeight: number;
  numberCharts: number;
};

const ChartRow = (props: ChartRowProps) => {
  const charts = props.numberCharts;
  const theme = useTheme();
  const palette = theme.charts.getColorPalette(charts);

  if (props.allowedCharts.length < charts) {
    throw new Error('Not enough allowed chart types to show row.');
  }

  return (
    <StyledRow minSize={200}>
      {new Array(charts).fill(0).map((_, index) => (
        <WidgetContainer
          {...props}
          key={index}
          index={index}
          chartHeight={props.chartHeight}
          chartColor={palette[index]}
          defaultChartSetting={props.allowedCharts[index]}
        />
      ))}
    </StyledRow>
  );
};

export const MiniChartRow = (props: ChartRowProps) => <ChartRow {...props} />;

MiniChartRow.defaultProps = {
  numberCharts: 3,
  chartHeight: 160,
};

export const DoubleChartRow = (props: ChartRowProps) => <ChartRow {...props} />;

DoubleChartRow.defaultProps = {
  numberCharts: 2,
  chartHeight: 300,
};

const StyledRow = styled(PerformanceLayoutBodyRow)`
  margin-bottom: ${space(2)};
`;

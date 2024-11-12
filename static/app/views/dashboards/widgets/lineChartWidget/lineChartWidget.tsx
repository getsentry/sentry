import styled from '@emotion/styled';

import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';
import {
  LineChartWidgetVisualization,
  type LineChartWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/lineChartWidget/lineChartWidgetVisualization';

import {X_GUTTER, Y_GUTTER} from '../common/settings';
import type {StateProps} from '../common/types';

interface Props
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    LineChartWidgetVisualizationProps {}

export function LineChartWidget(props: Props) {
  const {timeseries} = props;

  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      actions={props.actions}
      error={props.error}
      onRetry={props.onRetry}
    >
      <LineChartWrapper>
        <LineChartWidgetVisualization
          timeseries={timeseries}
          utc={props.utc}
          meta={props.meta}
        />
      </LineChartWrapper>
    </WidgetFrame>
  );
}

const LineChartWrapper = styled('div')`
  flex-grow: 1;
  padding: 0 ${X_GUTTER} ${Y_GUTTER} ${X_GUTTER};
`;

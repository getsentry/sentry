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
  if (props.isLoading) {
    return (
      <WidgetFrame title={props.title} description={props.description}>
        LOADING
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      actions={props.actions}
      error={props.error}
      onRetry={props.onRetry}
    >
      <LineChartWrapper>
        <LineChartWidgetVisualization />
      </LineChartWrapper>
    </WidgetFrame>
  );
}

const LineChartWrapper = styled('div')`
  padding: ${X_GUTTER} 0 ${X_GUTTER} ${Y_GUTTER};
`;

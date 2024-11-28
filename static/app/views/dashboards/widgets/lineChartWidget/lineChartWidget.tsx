import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {defined} from 'sentry/utils';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';
import {
  LineChartWidgetVisualization,
  type LineChartWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/lineChartWidget/lineChartWidgetVisualization';

import {MISSING_DATA_MESSAGE, X_GUTTER, Y_GUTTER} from '../common/settings';
import type {StateProps} from '../common/types';

interface Props
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<LineChartWidgetVisualizationProps> {}

export function LineChartWidget(props: Props) {
  const {timeseries} = props;

  if (props.isLoading) {
    return (
      <WidgetFrame title={props.title} description={props.description}>
        <LoadingPlaceholder>
          <TransparentLoadingMask visible />
          <LoadingIndicator mini />
        </LoadingPlaceholder>
      </WidgetFrame>
    );
  }

  let parsingError: string | undefined = undefined;

  if (!defined(timeseries)) {
    parsingError = MISSING_DATA_MESSAGE;
  }

  const error = props.error ?? parsingError;

  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      actions={props.actions}
      error={error}
      onRetry={props.onRetry}
    >
      {defined(timeseries) && (
        <LineChartWrapper>
          <LineChartWidgetVisualization
            timeseries={timeseries}
            utc={props.utc}
            meta={props.meta}
            dataCompletenessDelay={props.dataCompletenessDelay}
          />
        </LineChartWrapper>
      )}
    </WidgetFrame>
  );
}

const LineChartWrapper = styled('div')`
  flex-grow: 1;
  padding: 0 ${X_GUTTER} ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingPlaceholder = styled('div')`
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;
`;

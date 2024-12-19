import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {defined} from 'sentry/utils';
import {
  AreaChartWidgetVisualization,
  type AreaChartWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/areaChartWidget/areaChartWidgetVisualization';
import {
  WidgetFrame,
  type WidgetFrameProps,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

import {MISSING_DATA_MESSAGE, X_GUTTER, Y_GUTTER} from '../common/settings';
import type {StateProps} from '../common/types';

export interface AreaChartWidgetProps
  extends StateProps,
    Omit<WidgetFrameProps, 'children'>,
    Partial<AreaChartWidgetVisualizationProps> {}

export function AreaChartWidget(props: AreaChartWidgetProps) {
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
        <AreaChartWrapper>
          <AreaChartWidgetVisualization
            timeseries={timeseries}
            releases={props.releases}
            meta={props.meta}
          />
        </AreaChartWrapper>
      )}
    </WidgetFrame>
  );
}

const AreaChartWrapper = styled('div')`
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
